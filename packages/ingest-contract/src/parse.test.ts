import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { computeChecksum } from "./checksum"
import { LIMITS } from "./limits"
import { parseSnapshot, parseSnapshotBatch } from "./parse"
import type { SnapshotDataV1 } from "./v1/snapshot"

type InvalidCase = {
  name: string
  description: string
  snapshot: unknown
  expect: { path: string; code: string }
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T

const invalid = readJson<{ cases: InvalidCase[] }>("../test-vectors/invalid-v1.json").cases
const vectors = readJson<{ vectors: { name: string; data: SnapshotDataV1 }[] }>(
  "../test-vectors/checksum-v1.json"
).vectors

function validSnapshot(sequence = 1) {
  const data = structuredClone(vectors[0]!.data)
  data.scheiben.rows[0]!.Nachname = "Mustermann"
  return {
    contractVersion: 1,
    source: "meyton-ssmdb2",
    sourceVersion: "6.0.2",
    epoch: 1,
    scheibenId: -7257056,
    sequence,
    observedAt: "2026-10-06T17:05:03.250Z",
    sessionTimeZone: "+00:00",
    data,
    checksum: computeChecksum(data),
  }
}

describe("parseSnapshot", () => {
  it("nimmt einen gültigen Snapshot an", () => {
    const result = parseSnapshot(validSnapshot())
    expect(result.ok).toBe(true)
  })

  it("nimmt jedes data aus den Testvektoren mit passender Prüfsumme an", () => {
    for (const vector of vectors) {
      const snapshot = { ...validSnapshot(), data: vector.data }
      snapshot.checksum = computeChecksum(vector.data)
      expect(parseSnapshot(snapshot), vector.name).toMatchObject({ ok: true })
    }
  })

  describe.each(invalid.map((c) => [c.name, c] as const))("lehnt %s ab", (_, c) => {
    const result = parseSnapshot(c.snapshot)

    it("mit dem erwarteten ersten Fehler", () => {
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.issues[0]).toEqual(c.expect)
    })

    it("ohne Inhalte in den Fehlern (SF-59)", () => {
      const text = JSON.stringify(result)
      expect(text).not.toContain("Mustermann")
      // Spaltennamen sind Daten der Quelle; die Pfade enden vor ihnen.
      for (const column of ["Nachname", "TotalRing01", "Ring01", "Zeitstempel"]) {
        expect(text).not.toContain(column)
      }
    })
  })

  it("jeder Fall der Datei enthält den Namen, den der Inhaltstest sucht", () => {
    for (const c of invalid) {
      expect(JSON.stringify(c.snapshot), c.name).toContain("Mustermann")
    }
  })

  it("meldet höchstens maxReportedIssues Fehler", () => {
    const snapshot = validSnapshot()
    snapshot.data.treffer.rows = Array.from({ length: 100 }, () => ({ x: "1" }))
    const result = parseSnapshot(snapshot)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toHaveLength(LIMITS.maxReportedIssues)
  })
})

describe("parseSnapshotBatch", () => {
  it("nimmt einen Stapel gültiger Snapshots an", () => {
    const result = parseSnapshotBatch({ snapshots: [validSnapshot(1), validSnapshot(2)] })
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.value.snapshots.map((s) => s.sequence)).toEqual([1, 2])
  })

  it("lehnt den ganzen Stapel ab, wenn ein Snapshot ungültig ist, und nennt seinen Index", () => {
    const broken = { ...validSnapshot(2), contractVersion: 2 }
    const result = parseSnapshotBatch({ snapshots: [validSnapshot(1), broken] })
    expect(result).toEqual({
      ok: false,
      issues: [{ path: "snapshots[1].contractVersion", code: "unsupported-contract-version" }],
    })
  })

  it("setzt den Index vor Pfade aus dem Schema", () => {
    const broken = validSnapshot(2)
    broken.data.treffer.rows[1]!.x = 23 as unknown as string
    const result = parseSnapshotBatch({ snapshots: [broken] })
    expect(result).toEqual({
      ok: false,
      issues: [{ path: "snapshots[0].data.treffer.rows[1]", code: "invalid_type" }],
    })
  })

  it.each([
    ["leer", { snapshots: [] }, "snapshots", "too_small"],
    [
      "zu groß",
      { snapshots: Array.from({ length: LIMITS.maxBatchSnapshots + 1 }, () => validSnapshot()) },
      "snapshots",
      "too_big",
    ],
    ["ohne Liste", { snapshots: "x" }, "snapshots", "invalid_type"],
    ["mit fremdem Feld", { snapshots: [validSnapshot()], extra: 1 }, "", "unrecognized_keys"],
    ["kein Objekt", null, "", "invalid_type"],
  ])("lehnt einen Stapel %s ab", (_, input, path, code) => {
    expect(parseSnapshotBatch(input)).toEqual({ ok: false, issues: [{ path, code }] })
  })
})
