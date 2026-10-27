import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { bombContent, buildPdf, type TestText } from "@vereinsheim/meyton-pdf/test-pdf"
import { READER_VERSION } from "@vereinsheim/meyton-pdf/reading"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { valuedPrintout } from "../../../test/printout"
import { printoutDir } from "./files"
import { storePrintout, valuesReadOf } from "./store"

// Erfundene Ausdrucke aus `buildPdf`; die Datei landet in einem eigenen Verzeichnis je Test.

const ZONE = "Europe/Berlin"
const footer = (id: string, page = 1): TestText[] => [
  { str: `ID: ${id} - Seite: ${page}`, x: 258, y: 26 },
]

let previousUploadDir: string | undefined
let dir: string

beforeEach(async () => {
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-store-"))
  process.env.UPLOAD_DIR = dir
})

afterEach(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
})

/** Dateien im Verzeichnis der Ausdrucke; fehlt es, keine */
const storedFiles = () => readdir(printoutDir()).catch(() => [] as string[])

describe("storePrintout: gespeichert", () => {
  it("mit Zeitzone im PDF", async () => {
    const bytes = await buildPdf({
      pages: [footer("ff914420")],
      font: "identity-h",
      info: { CreationDate: "D:20261002195212+02'00'" },
    })
    const result = await storePrintout({ bytes, timeZone: ZONE, fileName: "print_x.pdf" })
    expect(result).toMatchObject({
      kind: "stored",
      file: { hex: "ff914420", scheibenId: -7257056, size: bytes.length, fileName: "print_x.pdf" },
    })
    if (result.kind !== "stored") throw new Error("nicht gespeichert")
    expect(result.file.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.file.printedAt.toISOString()).toBe("2026-10-02T17:52:12.000Z")
    expect(await storedFiles()).toEqual([`${result.file.sha256}.pdf`])
  })

  it("ohne Zeitzone: die Wanduhr in der Zone der Anlage", async () => {
    const bytes = await buildPdf({
      pages: [footer("ff914420")],
      info: { CreationDate: "D:20261002195212" },
    })
    const result = await storePrintout({ bytes, timeZone: ZONE })
    if (result.kind !== "stored") throw new Error("nicht gespeichert")
    expect(result.file.printedAt.toISOString()).toBe("2026-10-02T17:52:12.000Z")
  })

  it("gleiche Bytes zweimal: eine Datei; ein unsicherer Name wird ersetzt", async () => {
    const bytes = await buildPdf({
      pages: [footer("ff914420")],
      info: { CreationDate: "D:20261002195212+02'00'" },
    })
    const first = await storePrintout({ bytes, timeZone: ZONE, fileName: "../x.pdf" })
    const second = await storePrintout({ bytes, timeZone: ZONE })
    expect(first).toMatchObject({ kind: "stored", file: { fileName: "ausdruck-ff914420.pdf" } })
    expect(second).toMatchObject({ kind: "stored" })
    expect(await storedFiles()).toHaveLength(1)
  })
})

describe("storePrintout: Werte", () => {
  it("stimmig: Status ok mit Lesung, Version und Layout", async () => {
    const result = await storePrintout({ bytes: await valuedPrintout(), timeZone: ZONE })
    if (result.kind !== "stored") throw new Error("nicht gespeichert")
    expect(result.file.values).toMatchObject({
      readerVersion: READER_VERSION,
      layout: "qt",
      status: "ok",
      discipline: "LP 40",
    })
    expect(result.file.values.reading?.shots).toHaveLength(40)
    expect(result.maxRssKb).toBeGreaterThan(0)
  }, 15_000)

  it("Widerspruch: inconsistent, ohne Lesung, die Disziplin bleibt", async () => {
    const bytes = await valuedPrintout({
      layout: "ghostscript",
      tamper: (spec) => (spec.result = "1 (0.1)"),
    })
    const result = await storePrintout({ bytes, timeZone: ZONE })
    if (result.kind !== "stored") throw new Error("nicht gespeichert")
    expect(result.file.values).toEqual({
      readerVersion: READER_VERSION,
      layout: "ghostscript",
      status: "inconsistent",
      reading: null,
      discipline: "LP 40",
    })
  }, 15_000)

  it("ohne Werte: empty; nicht lesbar: unreadable", async () => {
    const bytes = await buildPdf({
      pages: [footer("ff914420")],
      info: { CreationDate: "D:20261002195212+02'00'" },
    })
    const result = await storePrintout({ bytes, timeZone: ZONE })
    expect(result.kind === "stored" && result.file.values.status).toBe("empty")
    expect(valuesReadOf({ kind: "failed", code: "timeout" })).toEqual({
      readerVersion: READER_VERSION,
      layout: null,
      status: "unreadable",
      reading: null,
      discipline: null,
    })
  })

  it("write: false liest nur und legt keine Datei an", async () => {
    const result = await storePrintout(
      { bytes: await valuedPrintout(), timeZone: ZONE },
      { write: false }
    )
    expect(result).toMatchObject({ kind: "stored", file: { values: { status: "ok" } } })
    expect(await storedFiles()).toEqual([])
  }, 15_000)
})

describe("storePrintout: abgelehnt, ohne Datei", () => {
  const info = { CreationDate: "D:20261002195212+02'00'" }

  it.each([
    ["noId", () => buildPdf({ pages: [[{ str: "Serie 1", x: 40, y: 400 }]], info })],
    ["idConflict", () => buildPdf({ pages: [footer("ff914420", 1), footer("46a13c20", 2)], info })],
    ["noTime", () => buildPdf({ pages: [footer("ff914420")], info: null })],
    ["notPdf", async () => new TextEncoder().encode("<html>kein PDF</html>")],
    ["notPdf", async () => new Uint8Array(0)],
    [
      "tooLarge",
      async () => {
        const big = new Uint8Array(1024 * 1024 + 1)
        big.set(new TextEncoder().encode("%PDF-1.4\n"))
        return big
      },
    ],
    ["unreadable", () => buildPdf({ pages: [[]], rawPages: [bombContent("memory")], info })],
  ] as const)("%s", async (reason, bytes) => {
    expect(await storePrintout({ bytes: await bytes(), timeZone: ZONE })).toEqual({
      kind: "rejected",
      reason,
    })
    expect(await storedFiles()).toEqual([])
  })
})

describe("storePrintout: Node zu alt", () => {
  it("gibt den Grund weiter, ohne Datei", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const bytes = await buildPdf({
        pages: [footer("ff914420")],
        info: { CreationDate: "D:20261002195212+02'00'" },
      })
      expect(await storePrintout({ bytes, timeZone: ZONE }, { nodeVersion: "24.12.0" })).toEqual({
        kind: "rejected",
        reason: "nodeVersion",
      })
      expect(await storedFiles()).toEqual([])
    } finally {
      log.mockRestore()
    }
  })
})
