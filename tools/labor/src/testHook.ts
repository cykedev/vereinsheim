// Prüfhaken (Plan D8): Mit #pruefen legt das Labor `window.__labor` an, damit die Skriptprüfung jede
// angezeigte Zahl gegen den Fachkern nachrechnet wie in der Spielwiese. Ohne #pruefen gibt es ihn nicht.

import * as analysis from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { analysisInput } from "@vereinsheim/shot-ui/analysis/input"
import { observations } from "@vereinsheim/shot-ui/analysis/observations"
import { overviewTiles } from "@vereinsheim/shot-ui/analysis/overview"
import { formatValue } from "@vereinsheim/shot-ui/format"
import { TILE_KEYS } from "@vereinsheim/shot-ui/metrics/MetricTiles"
import { selectionShots, shotIntervals, shotLabels } from "@vereinsheim/shot-ui/shots"
import type { ViewState } from "@vereinsheim/shot-ui/view-state"

const TOOLS = {
  computeMetric,
  inScoring,
  metricByKey,
  helpForMetric,
  formatValue,
  selectionShots,
  shotIntervals,
  shotLabels,
  TILE_KEYS,
  // Analyse (Schritt 3): die Auswertungen des Fachkerns und die Modelle des Überblicks zum Nachrechnen
  analysis,
  analysisInput,
  overviewTiles,
  observations,
}

export interface LaborHook {
  shots: readonly MetricShot[]
  state: ViewState
  tools: typeof TOOLS
}

declare global {
  interface Window {
    __labor?: LaborHook
  }
}

/** läuft die Seite in der Skriptprüfung? */
export const underTest = () => typeof location !== "undefined" && location.hash === "#pruefen"

/** den aktuellen Stand für die Skriptprüfung ablegen; außerhalb von #pruefen nichts */
export function exposeForTest(shots: readonly MetricShot[], state: ViewState) {
  if (underTest()) window.__labor = { shots, state, tools: TOOLS }
}
