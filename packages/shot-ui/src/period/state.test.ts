import { describe, expect, it } from "vitest"

import { initialPeriodState, periodReducer, type PeriodAction, type PeriodState } from "./state"

const base = initialPeriodState({ family: "lg-10m" })
const chosen: PeriodState = { ...base, chosen: "k12" }

describe("Zustand der Seite eines Zeitraums", () => {
  it("Vorgaben: 90 Tage, ohne Vergleich, alle Arten, ohne Einschießen, Zehntel, Ø je Schuss", () => {
    expect(base).toEqual({
      choice: { type: "rolling", days: 90 },
      compare: { type: "none" },
      family: "lg-10m",
      kind: "all",
      includeWarmup: false,
      scoring: "decimal",
      metric: "result.decimalMean",
      view: null,
      show: "history",
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
      [{ type: "setIncludeWarmup", include: true }, { includeWarmup: true }],
      [{ type: "setScoring", scoring: "rings" }, { scoring: "rings" }],
      [{ type: "setMetric", metric: "group.sigma" }, { metric: "group.sigma" }],
      [{ type: "setView", view: "months" }, { view: "months" }],
      [{ type: "setShow", show: "target" }, { show: "target" }],
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
      { type: "setIncludeWarmup", include: true },
    ]
    for (const action of changes)
      expect(periodReducer(chosen, action).chosen, action.type).toBeNull()
  })

  it("das Blatt „Filter“ setzt alles auf einmal; die Wahl fällt nur weg, wenn sich die Scheiben ändern", () => {
    const filters = {
      choice: chosen.choice,
      compare: { type: "previous" as const },
      kind: chosen.kind,
      includeWarmup: chosen.includeWarmup,
    }
    const onlyCompare = periodReducer(chosen, { type: "setFilters", filters })
    expect(onlyCompare.compare).toEqual({ type: "previous" })
    expect(onlyCompare.chosen).toBe("k12")
    const all = periodReducer(chosen, {
      type: "setFilters",
      filters: {
        choice: { type: "rolling", days: 30 },
        compare: { type: "none" },
        kind: "training",
        includeWarmup: true,
      },
    })
    expect(all).toMatchObject({
      choice: { type: "rolling", days: 30 },
      compare: { type: "none" },
      kind: "training",
      includeWarmup: true,
      chosen: null,
    })
  })

  it("die Wahl bleibt bei Vergleich, Wertung, Kennzahl und Darstellung", () => {
    const keeps: PeriodAction[] = [
      { type: "setCompare", compare: { type: "previous" } },
      { type: "setScoring", scoring: "rings" },
      { type: "setMetric", metric: "result.tensRate" },
      { type: "setView", view: "cards" },
      { type: "setShow", show: "target" },
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

  it("„restore“ ersetzt den ganzen Zustand, etwa beim Zurück aus der Adresse", () => {
    const next = initialPeriodState({ family: "lp-10m", kind: "training", chosen: "k3" })
    expect(periodReducer(chosen, { type: "restore", state: next })).toEqual(next)
  })
})
