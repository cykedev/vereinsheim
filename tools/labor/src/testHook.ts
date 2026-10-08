// Prüfhaken (Plan D8): Mit #pruefen legt das Labor `window.__labor` an, damit die Skriptprüfung jede
// angezeigte Zahl gegen den Fachkern nachrechnet wie in der Spielwiese. Ohne #pruefen gibt es ihn nicht.

import * as analysis from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { FALLACIES, READING_GUIDE, VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { helpForMetric, helpTopic } from "@vereinsheim/shot-help/lookup"
import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"
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
  // Hilfe aus dem Paket, gegen die die Prüfung Texte und Plätze vergleicht
  helpTopic,
  HELP_TOPICS,
  VIEW_HELP,
  READING_GUIDE,
  GLOSSARY,
  FALLACIES,
}

export interface LaborHook {
  shots: readonly MetricShot[]
  state: ViewState
  target: TargetImage
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
export function exposeForTest(shots: readonly MetricShot[], state: ViewState, target: TargetImage) {
  if (underTest()) window.__labor = { shots, state, target, tools: TOOLS }
}
