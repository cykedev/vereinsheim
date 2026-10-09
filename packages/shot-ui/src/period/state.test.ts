import { describe, expect, it } from "vitest"

import { initialPeriodState, periodReducer, type PeriodAction, type PeriodState } from "./state"

const base = initialPeriodState({ family: "lg-10m" })
const chosen: PeriodState = { ...base, chosen: "k12" }

describe("Zustand der Seite eines Zeitraums", () => {
  it("Vorgaben: 90 Tage, ohne Vergleich, alle Arten, Training nur aus Probe zählt, Zehntel, Ø je Schuss", () => {
    expect(base).toEqual({
      choice: { type: "rolling", days: 90 },
      compare: { type: "none" },
      family: "lg-10m",
      kind: "all",
      includeProbeOnly: true,
      scoring: "decimal",
      metric: "result.decimalMean",
      view: null,
      chosen: null,
    })
    expect(initialPeriodState({ family: "lp-10m", scoring: "rings" }).scoring).toBe("rings")
  })

  it("jede Aktion setzt ihr Feld", () => {
    const steps: [PeriodAction, Partial<PeriodState>][] = [
      [{ type: "setChoice", choice: { type: "all" } }, { choice: { type: "all" } }],
      [{ type: "setCompare", compare: { type: "previous" } }, { compare: { type: "previous" } }],
      [{ type: "setFamily", family: "lp-10m" }, { family: "lp-10m" }],
      [{ type: "setKind", kind: "competition" }, { kind: "competition" }],
      [{ type: "setIncludeProbeOnly", include: false }, { includeProbeOnly: false }],
      [{ type: "setScoring", scoring: "rings" }, { scoring: "rings" }],
      [{ type: "setMetric", metric: "group.sigma" }, { metric: "group.sigma" }],
      [{ type: "setView", view: "months" }, { view: "months" }],
      [{ type: "choose", id: "k3" }, { chosen: "k3" }],
    ]
    for (const [action, expected] of steps) {
      expect(periodReducer(base, action), action.type).toMatchObject(expected)
    }
  })

  it("die Wahl fällt weg, wenn sich die Menge der Scheiben ändert", () => {
    const changes: PeriodAction[] = [
      { type: "setChoice", choice: { type: "rolling", days: 30 } },
      { type: "setFamily", family: "lp-10m" },
      { type: "setKind", kind: "training" },
      { type: "setIncludeProbeOnly", include: false },
    ]
    for (const action of changes)
      expect(periodReducer(chosen, action).chosen, action.type).toBeNull()
  })

  it("die Wahl bleibt bei Vergleich, Wertung, Kennzahl und Darstellung", () => {
    const keeps: PeriodAction[] = [
      { type: "setCompare", compare: { type: "previous" } },
      { type: "setScoring", scoring: "rings" },
      { type: "setMetric", metric: "result.tensRate" },
      { type: "setView", view: "cards" },
    ]
    for (const action of keeps)
      expect(periodReducer(chosen, action).chosen, action.type).toBe("k12")
  })

  it("das Lineal wählt ohne Umschalten", () => {
    expect(periodReducer(chosen, { type: "pick", id: "k12" }).chosen).toBe("k12")
    expect(periodReducer(chosen, { type: "pick", id: "k3" }).chosen).toBe("k3")
    expect(periodReducer(chosen, { type: "pick", id: null }).chosen).toBeNull()
  })

  it("dieselbe Scheibe noch einmal hebt die Wahl auf, null auch", () => {
    expect(periodReducer(chosen, { type: "choose", id: "k12" }).chosen).toBeNull()
    expect(periodReducer(chosen, { type: "choose", id: null }).chosen).toBeNull()
    expect(periodReducer(chosen, { type: "choose", id: "k13" }).chosen).toBe("k13")
  })
})
