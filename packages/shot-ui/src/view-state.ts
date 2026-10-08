// Zustand der Scheibe als Reducer: was gewählt ist und wie gezeichnet wird. Dieselbe Verdrahtung nutzen
// Labor und später die App; die Daten (Schüsse, Scheibenbild) kommen von außen.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { SeriesKey, Selection } from "./types"

export type Layer = "mpi" | "circle" | "numbers" | "ellipse"

export interface ViewState {
  /** „all“ oder gewählte Serien und Probe, Probe zuerst, Serien aufsteigend */
  selection: Selection
  /** der angetippte Schuss mit seiner Serie, damit er mit der Auswahl wegfallen kann */
  chosen: { index: number; series: SeriesKey } | null
  view: "target" | "group"
  layers: Readonly<Record<Layer, boolean>>
  scoring: Scoring
  /** Nummern der Probeschüsse, nach denen das Visier verstellt wurde, aufsteigend */
  adjustAfter: readonly number[]
}

export type ViewAction =
  | { type: "select"; series: SeriesKey }
  | { type: "selectAll" }
  | { type: "choose"; shot: number; series: SeriesKey }
  | { type: "setView"; view: ViewState["view"] }
  | { type: "toggle"; layer: Layer }
  | { type: "setScoring"; scoring: Scoring }
  | { type: "toggleAdjust"; after: number }
  /** neue Scheibe: Auswahl, Schuss und Ausschnitt zurück; Wertung und Ebenen bleiben */
  | { type: "reset"; adjustAfter?: readonly number[] }

/** Ebenen wie in der Spielwiese: Schwerpunkt und Streukreis an, Nummern und Ellipse aus */
export function initialViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    selection: "all",
    chosen: null,
    view: "target",
    layers: { mpi: true, circle: true, numbers: false, ellipse: false },
    scoring: "decimal",
    adjustAfter: [],
    ...overrides,
  }
}

export const isSelected = (selection: Selection, key: SeriesKey) =>
  selection === "all" || selection.includes(key)

const order = (key: SeriesKey) => (key === "probe" ? 0 : key)

function toggled(selection: Selection, key: SeriesKey): Selection {
  const current = selection === "all" ? [] : selection
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
  return next.length === 0 ? "all" : [...next].sort((a, b) => order(a) - order(b))
}

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "select":
    case "selectAll": {
      const selection = action.type === "select" ? toggled(state.selection, action.series) : "all"
      const chosen =
        state.chosen && isSelected(selection, state.chosen.series) ? state.chosen : null
      return { ...state, selection, chosen }
    }
    case "choose":
      return {
        ...state,
        chosen:
          state.chosen?.index === action.shot
            ? null
            : { index: action.shot, series: action.series },
      }
    case "setView":
      return { ...state, view: action.view }
    case "toggle":
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } }
    case "setScoring":
      return { ...state, scoring: action.scoring }
    case "toggleAdjust": {
      const has = state.adjustAfter.includes(action.after)
      const adjustAfter = has
        ? state.adjustAfter.filter((n) => n !== action.after)
        : [...state.adjustAfter, action.after].sort((a, b) => a - b)
      return { ...state, adjustAfter }
    }
    case "reset":
      return {
        ...state,
        selection: "all",
        chosen: null,
        view: "target",
        adjustAfter: action.adjustAfter ?? [],
      }
  }
}
