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
import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { FALLACIES, READING_GUIDE, VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { helpForMetric, helpTopic } from "@vereinsheim/shot-help/lookup"
import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"
import { analysisInput } from "@vereinsheim/shot-ui/analysis/input"
import { observations } from "@vereinsheim/shot-ui/analysis/observations"
import { overviewTiles } from "@vereinsheim/shot-ui/analysis/overview"
import { formatValue } from "@vereinsheim/shot-ui/format"
import { routeFromUrl, urlFromRoute } from "@vereinsheim/shot-ui/nav/routes"
import { periodModel, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { periodSentence, verdictText } from "@vereinsheim/shot-ui/period/sentence"
import type { PeriodState } from "@vereinsheim/shot-ui/period/state"
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
  // Seite eines Zeitraums (Plan L3): Modell und Worte zum Nachrechnen
  period: { periodModel, periodSentence, verdictText },
  // Adressen (Plan N1): die Prüfung rechnet jede gezeigte Adresse hin und zurück
  nav: { routeFromUrl, urlFromRoute },
}

export interface LaborHook {
  shots?: readonly MetricShot[]
  state?: ViewState
  target?: TargetImage
  /** die Seite eines Zeitraums: Scheiben der Familie, Zustand, Modell */
  period?: { cards: readonly PeriodCard[]; state: PeriodState; model: PeriodModel }
  tools: typeof TOOLS
}

declare global {
  interface Window {
    __labor?: LaborHook
  }
}

// beim Laden festgehalten: Anker der Sprungleiste (#analyse …) ändern die Adresse während der Prüfung
const TEST_AT_LOAD = typeof location !== "undefined" && location.hash === "#pruefen"

/** läuft die Seite in der Skriptprüfung? (so, wie sie geladen wurde) */
export const underTest = () => TEST_AT_LOAD

/** den aktuellen Stand für die Skriptprüfung ablegen; außerhalb von #pruefen nichts */
export function exposeForTest(shots: readonly MetricShot[], state: ViewState, target: TargetImage) {
  if (underTest()) window.__labor = { ...window.__labor, shots, state, target, tools: TOOLS }
}

/** den Stand der Seite eines Zeitraums für die Skriptprüfung ablegen; außerhalb von #pruefen nichts */
export function exposePeriodForTest(period: NonNullable<LaborHook["period"]>) {
  if (underTest()) window.__labor = { ...window.__labor, period, tools: TOOLS }
}
