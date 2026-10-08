// Zustand der Scheibe als Reducer: was gewählt ist und wie gezeichnet wird. Dieselbe Verdrahtung nutzen
// Labor und später die App; die Daten (Schüsse, Scheibenbild) kommen von außen.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { SeriesKey, Selection, Whole } from "./types"

export type Layer = "mpi" | "circle" | "numbers" | "ellipse"

export interface ViewState {
  /** die ganze Scheibe (mit oder ohne Probe) oder genau eine Serie bzw. die Probe */
  selection: Selection
  /** Grundauswahl der Scheibe (`defaultWhole`): dorthin führt ein zweiter Tipp auf dieselbe Serie */
  home: Whole
  /** der angetippte Schuss mit seiner Serie (null: ohne Serie), damit er mit der Auswahl wegfallen kann */
  chosen: { index: number; series: SeriesKey | null } | null
  view: "target" | "group"
  layers: Readonly<Record<Layer, boolean>>
  scoring: Scoring
}

export type ViewAction =
  | { type: "select"; series: SeriesKey }
  | { type: "selectWhole"; whole: Whole }
  | { type: "choose"; shot: number; series: SeriesKey | null }
  | { type: "setView"; view: ViewState["view"] }
  | { type: "toggle"; layer: Layer }
  | { type: "setScoring"; scoring: Scoring }
  /** neue Scheibe: Auswahl auf ihre Grundauswahl, Schuss und Ausschnitt zurück; Wertung, Ebenen bleiben */
  | { type: "reset"; home?: Whole }

/** Ebenen wie in der Spielwiese: Schwerpunkt und Streukreis an, Nummern und Ellipse aus */
export function initialViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    selection: "all",
    home: "all",
    chosen: null,
    view: "target",
    layers: { mpi: true, circle: true, numbers: false, ellipse: false },
    scoring: "decimal",
    ...overrides,
  }
}

/**
 * Gehört eine Serie zur Auswahl? „all“ nimmt alles, „match“ alles außer der Probe (auch Wertung ohne
 * Serie, null); eine einzelne Serie nur sich selbst.
 */
export const isSelected = (selection: Selection, key: SeriesKey | null) =>
  selection === "all" || (selection === "match" ? key !== "probe" : selection === key)

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "select":
    case "selectWhole": {
      // Tippen wählt genau diese Serie; dieselbe noch einmal führt zur Grundauswahl zurück
      const selection: Selection =
        action.type === "selectWhole"
          ? action.whole
          : state.selection !== action.series
            ? action.series
            : state.home
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
    case "reset": {
      const home = action.home ?? "all"
      return {
        ...state,
        selection: home,
        home,
        chosen: null,
        view: "target",
      }
    }
  }
}
