// Zustand der Seite eines Zeitraums (Plan L3, D3, D8): Zeitraum, Vergleich, Filter, Wertung, Kennzahl und
// Darstellung des Verlaufs, die gewählte Scheibe. Reine Funktionen, die Seite hält den Zustand.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { DEFAULT_CHOICE, type CompareChoice, type PeriodChoice } from "./calendar"

/** Kennzahlen des Verlaufs: nur solche, die nicht an der Schusszahl hängen (D7) */
export type PeriodMetricKey =
  | "result.decimalMean"
  | "group.sigma"
  | "result.tensRate"
  | "time.intervalMedian"

export type CardKind = "all" | "training" | "competition"

export interface PeriodState {
  choice: PeriodChoice
  compare: CompareChoice
  /** Disziplin-Familie, Pflicht; die Seite filtert die Scheiben danach */
  family: string
  kind: CardKind
  /** Training nur aus Probe mitzählen (L2, D8) */
  includeProbeOnly: boolean
  scoring: Scoring
  metric: PeriodMetricKey
  /** Darstellung des Verlaufs; null: nach der Zahl der Scheiben (D7) */
  view: "cards" | "months" | null
  /** gewählte Scheibe (Id); null: keine, die Ablesung zeigt die neueste */
  chosen: string | null
}

export type PeriodAction =
  | { type: "setChoice"; choice: PeriodChoice }
  | { type: "setCompare"; compare: CompareChoice }
  | { type: "setFamily"; family: string }
  | { type: "setKind"; kind: CardKind }
  | { type: "setIncludeProbeOnly"; include: boolean }
  | { type: "setScoring"; scoring: Scoring }
  | { type: "setMetric"; metric: PeriodMetricKey }
  | { type: "setView"; view: "cards" | "months" }
  | { type: "choose"; id: string | null }

export function initialPeriodState(
  partial: Partial<PeriodState> & { family: string }
): PeriodState {
  return {
    choice: DEFAULT_CHOICE,
    compare: { type: "none" },
    kind: "all",
    includeProbeOnly: false,
    scoring: "decimal",
    metric: "result.decimalMean",
    view: null,
    chosen: null,
    ...partial,
  }
}

/**
 * Ändert sich die Menge der Scheiben (Zeitraum, Familie, Art, nur Probe), fällt die Wahl weg; Vergleich,
 * Wertung, Kennzahl und Darstellung lassen sie stehen. Dieselbe Scheibe noch einmal hebt die Wahl auf, wie
 * ein zweites Tippen auf denselben Schuss.
 */
export function periodReducer(state: PeriodState, action: PeriodAction): PeriodState {
  switch (action.type) {
    case "setChoice":
      return { ...state, choice: action.choice, chosen: null }
    case "setCompare":
      return { ...state, compare: action.compare }
    case "setFamily":
      return { ...state, family: action.family, chosen: null }
    case "setKind":
      return { ...state, kind: action.kind, chosen: null }
    case "setIncludeProbeOnly":
      return { ...state, includeProbeOnly: action.include, chosen: null }
    case "setScoring":
      return { ...state, scoring: action.scoring }
    case "setMetric":
      return { ...state, metric: action.metric }
    case "setView":
      return { ...state, view: action.view }
    case "choose":
      return { ...state, chosen: action.id === state.chosen ? null : action.id }
  }
}
