import { describe, expect, it } from "vitest"

import { GOAL_ERRORS } from "./texts"
import { parseGoal, parseThreshold, storedMeasure, type GoalInput } from "./validation"

const FAMILIES = new Set([7])
const input = (extra: Partial<GoalInput> = {}): GoalInput => ({
  title: "  355 im   Training  ",
  kind: "result",
  familyId: 7,
  from: "2026-09-01",
  to: "2027-08-31",
  measure: { measure: "card", threshold: "355", scoring: "rings", shots: 40, cards: "training" },
  ...extra,
})

describe("parseThreshold", () => {
  it("ganze Ringe ohne Stelle, Zehntel mit einer, Komma oder Punkt", () => {
    expect(parseThreshold("355", "rings")).toBe(355)
    expect(parseThreshold("355,5", "rings")).toBeNull()
    expect(parseThreshold("365,5", "decimal")).toBe(365.5)
    expect(parseThreshold("365.5", "decimal")).toBe(365.5)
    expect(parseThreshold("365,55", "decimal")).toBeNull()
    expect(parseThreshold("0", "rings")).toBeNull()
    expect(parseThreshold("", "rings")).toBeNull()
  })
})

describe("parseGoal", () => {
  it("ein Ergebnisziel mit Messung; der Satz ohne doppelten Leerraum", () => {
    expect(parseGoal(input(), FAMILIES)).toEqual({
      data: {
        title: "355 im Training",
        kind: "result",
        familyId: 7,
        from: "2026-09-01",
        to: "2027-08-31",
        measure: {
          measure: "card",
          threshold: 355,
          scoring: "rings",
          shots: 40,
          cards: "training",
        },
      },
    })
  })

  it("ein Prozessziel verliert die Messung; ohne Disziplin geht es", () => {
    const result = parseGoal(input({ kind: "process", familyId: null }), FAMILIES)
    expect(result).toMatchObject({ data: { kind: "process", familyId: null, measure: null } })
  })

  it("Messung nur mit Disziplin", () => {
    expect(parseGoal(input({ familyId: null }), FAMILIES)).toEqual({
      fieldErrors: { familyId: [GOAL_ERRORS.family] },
    })
    expect(parseGoal(input({ familyId: null, measure: null }), FAMILIES)).toMatchObject({
      data: { familyId: null, measure: null },
    })
  })

  it("Feldfehler: Satz, Zeitraum, Schwelle, Schusszahl", () => {
    expect(parseGoal(input({ title: "  " }), FAMILIES)).toEqual({
      fieldErrors: { title: [GOAL_ERRORS.title] },
    })
    expect(parseGoal(input({ title: "x".repeat(201) }), FAMILIES)).toEqual({
      fieldErrors: { title: [GOAL_ERRORS.titleLong] },
    })
    expect(parseGoal(input({ to: "2026-08-31" }), FAMILIES)).toEqual({
      fieldErrors: { to: [GOAL_ERRORS.range] },
    })
    const tooHigh = input()
    tooHigh.measure = { ...tooHigh.measure!, threshold: "401" }
    expect(parseGoal(tooHigh, FAMILIES)).toEqual({
      fieldErrors: { threshold: [GOAL_ERRORS.tooHigh(40)] },
    })
    const tenths = input()
    tenths.measure = { ...tenths.measure!, scoring: "decimal", threshold: "436" }
    expect(parseGoal(tenths, FAMILIES)).toMatchObject({ data: { measure: { threshold: 436 } } })
    const shots = input()
    shots.measure = { ...shots.measure!, shots: 0 }
    expect(parseGoal(shots, FAMILIES)).toEqual({ fieldErrors: { shots: [GOAL_ERRORS.shots] } })
  })

  it("eine fremde Disziplin oder Unsinn ist ungültig", () => {
    expect(parseGoal(input({ familyId: 8 }), FAMILIES)).toEqual({ invalid: true })
    expect(parseGoal({ title: 1 }, FAMILIES)).toEqual({ invalid: true })
    expect(parseGoal(input({ from: "2026-02-30" }), FAMILIES)).toEqual({ invalid: true })
  })
})

describe("storedMeasure", () => {
  const row = {
    measure: "series" as const,
    threshold: "92.0",
    scoring: "rings" as const,
    shots: 10,
    cards: "all" as const,
  }

  it("alle vier gesetzt: die Messung", () => {
    expect(storedMeasure(row)).toEqual({
      measure: "series",
      threshold: 92,
      scoring: "rings",
      shots: 10,
      cards: "all",
    })
  })

  it("fehlt eines der vier, gilt die Messung als nicht gesetzt", () => {
    expect(storedMeasure({ ...row, measure: null })).toBeNull()
    expect(storedMeasure({ ...row, threshold: null })).toBeNull()
    expect(storedMeasure({ ...row, scoring: null })).toBeNull()
    expect(storedMeasure({ ...row, shots: null })).toBeNull()
  })
})
