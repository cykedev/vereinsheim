// Darstellung der Scheibe als Voreinstellung des Schützen (User, 12. Oktober 2026): die Ebenen, „übrige blass/aus“ und
// der Ausschnitt (ganze Scheibe oder Gruppe). Sie gehört nicht in die Adresse (die hält fest, was man sieht, nicht wie
// es gezeichnet ist), sondern in den Browser; jede Änderung schreibt sie neu. Reine Funktionen: wo gespeichert wird,
// entscheidet die App (Cookie) bzw. das Labor (`localStorage`).

import { initialViewState, type Layer, type ViewState } from "../view-state"

/** wie die Schüsse außerhalb der Auswahl erscheinen: blass oder gar nicht */
export type Others = "dim" | "hide"

export interface TargetDisplay {
  layers: Readonly<Record<Layer, boolean>>
  others: Others
  view: ViewState["view"]
}

export const DEFAULT_TARGET_DISPLAY: TargetDisplay = {
  layers: initialViewState().layers,
  others: "dim",
  view: initialViewState().view,
}

const LAYERS: readonly Layer[] = ["mpi", "circle", "numbers", "ellipse"]

/** gespeicherter Text → Darstellung; kaputt, alt oder fremd gilt Feld für Feld die Vorgabe */
export function parseTargetDisplay(text: string | null | undefined): TargetDisplay {
  let value: unknown = null
  try {
    value = text ? JSON.parse(text) : null
  } catch {
    value = null
  }
  const object = value && typeof value === "object" ? value : {}
  const saved = object as { layers?: unknown; others?: unknown; view?: unknown }
  const layers =
    saved.layers && typeof saved.layers === "object"
      ? (saved.layers as Record<string, unknown>)
      : {}
  return {
    layers: Object.fromEntries(
      LAYERS.map((layer) => [
        layer,
        typeof layers[layer] === "boolean"
          ? (layers[layer] as boolean)
          : DEFAULT_TARGET_DISPLAY.layers[layer],
      ])
    ) as Record<Layer, boolean>,
    others:
      saved.others === "dim" || saved.others === "hide"
        ? saved.others
        : DEFAULT_TARGET_DISPLAY.others,
    view:
      saved.view === "target" || saved.view === "group" ? saved.view : DEFAULT_TARGET_DISPLAY.view,
  }
}

/** Darstellung → kurzer Text zum Speichern */
export function serializeTargetDisplay(display: TargetDisplay): string {
  return JSON.stringify({ layers: display.layers, others: display.others, view: display.view })
}
