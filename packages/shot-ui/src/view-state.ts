// Zustand der Scheibe als Reducer: was gewählt ist und wie gezeichnet wird. Die Verdrahtung macht
// die App; die Daten (Schüsse, Scheibenbild) kommen von außen.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { SeriesKey, Selection, Whole } from "./types"

export type Layer = "mpi" | "circle" | "numbers" | "ellipse"

export interface ViewState {
  /** die ganze Scheibe oder genau eine Serie */
  selection: Selection
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
  /**
   * einen Schuss zeigen, etwa aus dem Lineal eines Diagramms: wählt ohne Umschalten; liegt er außerhalb der
   * Auswahl, gilt wieder die ganze Scheibe, damit er zu sehen ist (Plan L1)
   */
  | { type: "show"; shot: number; series: SeriesKey | null }
  | { type: "setView"; view: ViewState["view"] }
  | { type: "toggle"; layer: Layer }
  /** die gemerkten Ebenen übernehmen (Darstellung als Voreinstellung); gleiche lassen den Zustand stehen */
  | { type: "setLayers"; layers: Readonly<Record<Layer, boolean>> }
  | { type: "setScoring"; scoring: Scoring }
  /** neue Scheibe: Auswahl auf die ganze Scheibe, Schuss zurück; Wertung, Ebenen und Ausschnitt bleiben */
  | { type: "reset" }

/** Ebenen wie in der Spielwiese: Schwerpunkt und Streukreis an, Nummern und Ellipse aus */
export function initialViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    selection: "all",
    chosen: null,
    view: "target",
    layers: { mpi: true, circle: true, numbers: false, ellipse: false },
    scoring: "decimal",
    ...overrides,
  }
}

/** Gehört eine Serie zur Auswahl? „all“ nimmt alles (auch einen Schuss ohne Serie, null), eine Serie nur sich */
export const isSelected = (selection: Selection, key: SeriesKey | null) =>
  selection === "all" || selection === key

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "select":
    case "selectWhole": {
      // Tippen wählt genau diese Serie; dieselbe noch einmal zeigt wieder die ganze Scheibe
      const selection: Selection =
        action.type === "selectWhole"
          ? action.whole
          : state.selection !== action.series
            ? action.series
            : "all"
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
    case "show":
      return {
        ...state,
        selection: isSelected(state.selection, action.series) ? state.selection : "all",
        chosen: { index: action.shot, series: action.series },
      }
    case "setView":
      return { ...state, view: action.view }
    case "toggle":
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } }
    case "setLayers": {
      const layers = action.layers
      const same = (Object.keys(state.layers) as Layer[]).every(
        (l) => state.layers[l] === layers[l]
      )
      return same ? state : { ...state, layers: { ...layers } }
    }
    case "setScoring":
      return { ...state, scoring: action.scoring }
    case "reset":
      return { ...state, selection: "all", chosen: null }
  }
}
