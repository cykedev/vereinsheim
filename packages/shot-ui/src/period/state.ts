// Zustand der Seite eines Zeitraums: Zeitraum, Vergleich, Filter, Wertung, Kennzahl und
// Darstellung des Verlaufs, die gewählte Scheibe. Reine Funktionen, die Seite hält den Zustand.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { DEFAULT_CHOICE, type CompareChoice, type PeriodChoice } from "./calendar"

/**
 * Kennzahlen des Verlaufs: nur solche, die nicht an der Schusszahl hängen; der Schwerpunkt-Abstand für Einträge, deren
 * Lage nur als Ganzes bekannt ist (Treffsicher: Trefferlage vom Ausdruck)
 */
export type PeriodMetricKey =
  | "result.decimalMean"
  | "group.sigma"
  | "result.tensRate"
  | "time.intervalMedian"
  | "group.mpiDistance"

export type CardKind = "all" | "training" | "competition"

/** was an der Stelle des Verlaufs steht: der Verlauf oder das Trefferbild */
export type PeriodShow = "history" | "target"

export interface PeriodState {
  choice: PeriodChoice
  compare: CompareChoice
  /** Disziplin-Familie, Pflicht; die Seite filtert die Scheiben danach */
  family: string
  kind: CardKind
  /**
   * Training nur aus Probe mitzählen; Vorgabe an, denn so trainieren die meisten
   */
  includeProbeOnly: boolean
  scoring: Scoring
  metric: PeriodMetricKey
  /** Darstellung des Verlaufs; null: nach der Zahl der Scheiben */
  view: "cards" | "months" | null
  /** Hauptbild: der Verlauf oder das Trefferbild über den Zeitraum (L9) */
  show: PeriodShow
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
  | { type: "setShow"; show: PeriodShow }
  | { type: "choose"; id: string | null }
  /** wählen ohne Umschalten (das Lineal): dieselbe Scheibe noch einmal bleibt gewählt */
  | { type: "pick"; id: string | null }
  /** den ganzen Zustand setzen, etwa aus der Adresse beim Zurück */
  | { type: "restore"; state: PeriodState }
  /**
   * das Blatt „Filter“ auf einmal: eine Aktion statt bis zu vier, damit eine App, die die Adresse aus dem
   * Zustand baut, keine Änderung verliert; die Wahl fällt weg, wenn sich die Menge der Scheiben ändert
   */
  | {
      type: "setFilters"
      filters: Pick<PeriodState, "choice" | "compare" | "kind" | "includeProbeOnly">
    }

export function initialPeriodState(
  partial: Partial<PeriodState> & { family: string }
): PeriodState {
  return {
    choice: DEFAULT_CHOICE,
    compare: { type: "none" },
    kind: "all",
    includeProbeOnly: true,
    scoring: "decimal",
    metric: "result.decimalMean",
    view: null,
    show: "history",
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
    case "setShow":
      return { ...state, show: action.show }
    case "choose":
      return { ...state, chosen: action.id === state.chosen ? null : action.id }
    case "pick":
      return { ...state, chosen: action.id }
    case "restore":
      return action.state
    case "setFilters": {
      const { choice, compare, kind, includeProbeOnly } = action.filters
      const same = JSON.stringify(choice) === JSON.stringify(state.choice)
      const cardsChange =
        !same || kind !== state.kind || includeProbeOnly !== state.includeProbeOnly
      return {
        ...state,
        choice,
        compare,
        kind,
        includeProbeOnly,
        chosen: cardsChange ? null : state.chosen,
      }
    }
  }
}
