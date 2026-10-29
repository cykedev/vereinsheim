import { describe, expect, it } from "vitest"

import { checkTransfer, unitStatus, type CheckUnit, type TableCheck } from "./check"

const unit = (over: Partial<CheckUnit> = {}): CheckUnit => ({
  sessionId: "s1",
  day: "2026-03-13",
  decision: "new",
  scoring: "WHOLE",
  before: { shots: 40, total: 360 },
  cardId: "c1",
  kept: false,
  after: { shots: 40, total: 360 },
  ...over,
})

describe("unitStatus", () => {
  it("gleiches Ergebnis und gleiche Schusszahl: gleich", () => {
    expect(unitStatus(unit())).toEqual({ kind: "same" })
    expect(unitStatus(unit({ decision: "existing" }))).toEqual({ kind: "same" })
    expect(unitStatus(unit({ decision: "uncertain" }))).toEqual({ kind: "same" })
  })

  it("eine absichtlich falsche Scheibe ist ein Befund", () => {
    expect(unitStatus(unit({ after: { shots: 40, total: 359 } }))).toEqual({
      kind: "finding",
      reason: "different",
    })
    expect(unitStatus(unit({ after: { shots: 30, total: 360 } }))).toMatchObject({
      kind: "finding",
    })
    expect(unitStatus(unit({ after: null }))).toEqual({ kind: "finding", reason: "noCard" })
  })

  it("Abweichungen nur erklärt: Abend nur aus Probe, geändert, Werte vom Ausdruck", () => {
    expect(unitStatus(unit({ decision: "probeEvening", cardId: null, after: null }))).toEqual({
      kind: "explained",
      reason: "probeEvening",
    })
    expect(unitStatus(unit({ kept: true, after: { shots: 40, total: 300 } }))).toEqual({
      kind: "explained",
      reason: "kept",
    })
    expect(unitStatus(unit({ adopted: true, after: { shots: 40, total: 361 } }))).toEqual({
      kind: "explained",
      reason: "adopted",
    })
  })

  it("ohne Ergebnis in Treffsicher nichts zu vergleichen", () => {
    expect(unitStatus(unit({ before: null, decision: "noResult" }))).toEqual({ kind: "noResult" })
    expect(unitStatus(unit({ decision: "notShooting" }))).toEqual({ kind: "noResult" })
  })

  it("ohne Gesamtergebnis in Treffsicher zählt nur die Schusszahl", () => {
    expect(unitStatus(unit({ before: { shots: 40, total: null } }))).toEqual({ kind: "same" })
    expect(unitStatus(unit({ before: { shots: 30, total: null } }))).toMatchObject({
      kind: "finding",
    })
  })
})

describe("checkTransfer", () => {
  const table = (over: Partial<TableCheck> = {}): TableCheck => ({
    name: "Ziele",
    before: 3,
    after: 3,
    explained: {},
    ...over,
  })

  it("zählt Befunde aus Einheiten und Tabellen, rechnet Ø je Schuss", () => {
    const result = checkTransfer({
      units: [unit(), unit({ sessionId: "s2", after: { shots: 40, total: 350 } })],
      tables: [
        table(),
        table({ name: "Anhänge", before: 5, after: 3, explained: { "Datei fehlt": 2 } }),
        table({ name: "Abläufe", before: 2, after: 1 }),
      ],
      sample: [],
    })
    expect(result.findings).toBe(2)
    expect(result.units[0].mean).toEqual({ before: 9, after: 9 })
    expect(result.units[1].mean.after).toBe(8.75)
    expect(result.tables.map((t) => t.finding)).toEqual([false, false, true])
  })

  it("eine Erklärung, die zu viel erklärt, ist auch ein Befund", () => {
    const result = checkTransfer({
      units: [],
      tables: [table({ before: 3, after: 3, explained: { "geändert, bleibt": 1 } })],
      sample: [],
    })
    expect(result.findings).toBe(1)
  })
})
