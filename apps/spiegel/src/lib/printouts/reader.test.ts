import { join } from "node:path"

import { bombContent, buildPdf, type TestText } from "@vereinsheim/meyton-pdf/test-pdf"
import { beforeAll, describe, expect, it } from "vitest"

import { childEnv, readerArgs, readerState, readPrintoutIsolated } from "./reader"

// Erfundene Ausdrucke aus `buildPdf`, kein echter. Ohne Bündel im Arbeitsverzeichnis startet der Kindprozess die
// Quelle über tsx; die Mechanik prüfen kleine Skripte in `__fixtures__`.

const QT_INFO = { CreationDate: "D:20261002195212+02'00'", Producer: "Qt 5.12.8" }
const footer = (id: string, page = 1): TestText[] => [
  { str: `ID: ${id} - Seite: ${page}`, x: 258, y: 26 },
]
const fixture = (name: string) => join(__dirname, "__fixtures__", `${name}-child.mjs`)

let qtPdf: Uint8Array

beforeAll(async () => {
  qtPdf = await buildPdf({ pages: [footer("ff914420")], font: "identity-h", info: QT_INFO })
})

/** nach jedem Fall: Die App liest wieder */
async function expectStillReads() {
  const again = await readPrintoutIsolated(qtPdf)
  expect(again).toMatchObject({ kind: "read", id: { kind: "found", hex: "ff914420" } })
}

describe("readPrintoutIsolated: Ausdrucke", () => {
  it("Qt-Ausdruck: ID und Erstellzeit", async () => {
    const result = await readPrintoutIsolated(qtPdf)
    expect(result).toMatchObject({
      kind: "read",
      pages: 1,
      id: { kind: "found", hex: "ff914420", value: -7257056 },
      createdAt: { epochMs: 1790963532000, offsetMinutes: 120, source: "info" },
    })
    if (result.kind === "read") expect(result.maxRssKb).toBeGreaterThan(0)
  })

  it("ohne ID: missing; zwei IDs: conflict", async () => {
    const none = await buildPdf({ pages: [[{ str: "Serie 1", x: 40, y: 400 }]], info: QT_INFO })
    expect(await readPrintoutIsolated(none)).toMatchObject({
      kind: "read",
      id: { kind: "missing" },
    })
    const two = await buildPdf({
      pages: [footer("ff914420", 1), footer("46a13c20", 2)],
      info: QT_INFO,
    })
    expect(await readPrintoutIsolated(two)).toMatchObject({
      kind: "read",
      id: { kind: "conflict" },
    })
  })

  it("der Code eines Fehlers kommt durch: zu viele Seiten", async () => {
    const pages = Array.from({ length: 11 }, (_, i) => footer("ff914420", i + 1))
    expect(await readPrintoutIsolated(await buildPdf({ pages, info: QT_INFO }))).toEqual({
      kind: "failed",
      reason: "tooManyPages",
    })
  })
})

describe("readPrintoutIsolated: Abbruch", () => {
  it("rechnet endlos: Zeitgrenze", async () => {
    const started = Date.now()
    expect(await readPrintoutIsolated(qtPdf, { script: fixture("hang"), maxParseMs: 300 })).toEqual(
      { kind: "failed", reason: "timeout" }
    )
    expect(Date.now() - started).toBeLessThan(2_000)
    await expectStillReads()
  })

  it("Heap voll: Speicher", async () => {
    expect(await readPrintoutIsolated(qtPdf, { script: fixture("alloc") })).toEqual({
      kind: "failed",
      reason: "memory",
    })
    await expectStillReads()
  })

  it("Ende ohne Ergebnis, Flut, ungültige Zeile: abgestürzt", async () => {
    for (const name of ["exit", "flood", "garbage"]) {
      expect(await readPrintoutIsolated(qtPdf, { script: fixture(name) })).toEqual({
        kind: "failed",
        reason: "crashed",
      })
    }
    await expectStillReads()
  })

  it("meldet sich nie bereit: Zeitgrenze des Starts", async () => {
    expect(await readPrintoutIsolated(qtPdf, { script: fixture("mute"), startupMs: 300 })).toEqual({
      kind: "failed",
      reason: "timeout",
    })
    await expectStillReads()
  })

  it("RSS über der Grenze: Speicher", async () => {
    expect(
      await readPrintoutIsolated(qtPdf, { script: fixture("hang"), rssOf: () => 512 * 1024 * 1024 })
    ).toEqual({ kind: "failed", reason: "memory" })
    await expectStillReads()
  })
})

describe("readPrintoutIsolated: präparierte PDFs mit dem echten Kindprozess", () => {
  it("Speicher-Bombe und Zeit-Bombe beenden den Kindprozess, die App bleibt klein", async () => {
    // erst die PDFs bauen: Das Bauen selbst belegt im Testprozess Speicher
    const memory = await buildPdf({ pages: [[]], rawPages: [bombContent("memory")], info: QT_INFO })
    const time = await buildPdf({ pages: [[]], rawPages: [bombContent("time")], info: QT_INFO })
    const rssBefore = process.memoryUsage().rss

    const memoryResult = await readPrintoutIsolated(memory)
    expect(memoryResult.kind).toBe("failed")
    if (memoryResult.kind === "failed") expect(["memory", "crashed"]).toContain(memoryResult.reason)

    // im selben Prozess braucht diese Bombe über 3 s (gemessen am 26. Oktober 2026: 3,3 s)
    const started = Date.now()
    expect(await readPrintoutIsolated(time, { maxParseMs: 1_000 })).toEqual({
      kind: "failed",
      reason: "timeout",
    })
    expect(Date.now() - started).toBeLessThan(5_000 + 2_000)

    expect(process.memoryUsage().rss - rssBefore).toBeLessThan(50 * 1024 * 1024)
    await expectStillReads()
  }, 30_000)
})

describe("readPrintoutIsolated: Warteschlange", () => {
  it("einer läuft, drei warten, der fünfte ist sofort busy", async () => {
    const states: ReturnType<typeof readerState>[] = []
    const watch = setInterval(() => states.push(readerState()), 10)
    const reads = Array.from({ length: 5 }, () =>
      readPrintoutIsolated(qtPdf, { script: fixture("hang"), maxParseMs: 300 })
    )
    expect(readerState()).toEqual({ running: true, waiting: 3 })
    const results = await Promise.all(reads)
    clearInterval(watch)
    const reasons = results.map((result) => (result.kind === "failed" ? result.reason : "read"))
    expect(reasons.filter((reason) => reason === "busy")).toHaveLength(1)
    expect(reasons.filter((reason) => reason === "timeout")).toHaveLength(4)
    // der busy kam sofort, ohne auf einen Platz zu warten
    expect(reasons[4]).toBe("busy")
    expect(states.length).toBeGreaterThan(0)
    expect(states.every((state) => state.waiting <= 3)).toBe(true)
    expect(readerState()).toEqual({ running: false, waiting: 0 })
  }, 15_000)
})

describe("Start des Kindprozesses", () => {
  it("ohne Bündel: Quelle über tsx mit mehr Heap; Umgebung nur NODE_ENV", () => {
    const args = readerArgs()
    expect(args).toContain("--import")
    expect(args).toContain("tsx")
    expect(args).toContain("--max-old-space-size=80")
    expect(args).toContain("--lite-mode")
    expect(readerArgs("/x/printout-reader.mjs")).toEqual([
      "--max-old-space-size=48",
      "--max-semi-space-size=2",
      "--lite-mode",
      "/x/printout-reader.mjs",
    ])
    expect(Object.keys(childEnv())).toEqual(["NODE_ENV"])
  })
})
