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
import { keyObservations, observations } from "@vereinsheim/shot-ui/analysis/observations"
import { overviewTiles } from "@vereinsheim/shot-ui/analysis/overview"
import { directionName, formatValue } from "@vereinsheim/shot-ui/format"
import type { CardListModel } from "@vereinsheim/shot-ui/list/evenings"
import type { StartModel } from "@vereinsheim/shot-ui/start/model"
import { routeFromUrl, urlFromRoute, type ListQuery } from "@vereinsheim/shot-ui/nav/routes"
import { periodModel, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { filterSummary } from "@vereinsheim/shot-ui/period/PeriodPicker"
import { recordRows } from "@vereinsheim/shot-ui/period/records"
import { periodSentence, verdictText } from "@vereinsheim/shot-ui/period/sentence"
import { weekLabel } from "@vereinsheim/shot-ui/period/calendar"
import type { PeriodState } from "@vereinsheim/shot-ui/period/state"
import {
  selectionShots,
  shotIntervals,
  shotLabels,
  shotPauseThreshold,
} from "@vereinsheim/shot-ui/shots"
import type { ViewState } from "@vereinsheim/shot-ui/view-state"

const TOOLS = {
  computeMetric,
  inScoring,
  metricByKey,
  helpForMetric,
  formatValue,
  directionName,
  selectionShots,
  shotIntervals,
  shotPauseThreshold,
  shotLabels,
  // Analyse (Schritt 3): die Auswertungen des Fachkerns und die Modelle des Überblicks zum Nachrechnen
  analysis,
  analysisInput,
  overviewTiles,
  observations,
  // der Kopf der Scheibe (U1): die wichtigsten Beobachtungen, je ihr Satz für den Kopf
  keyObservations,
  // Hilfe aus dem Paket, gegen die die Prüfung Texte und Plätze vergleicht
  helpTopic,
  HELP_TOPICS,
  VIEW_HELP,
  READING_GUIDE,
  GLOSSARY,
  FALLACIES,
  // Seite eines Zeitraums (Plan L3): Modell und Worte zum Nachrechnen
  period: { periodModel, periodSentence, verdictText, recordRows, filterSummary, weekLabel },
  // Adressen (Plan N1): die Prüfung rechnet jede gezeigte Adresse hin und zurück
  nav: { routeFromUrl, urlFromRoute },
}

export interface LaborHook {
  shots?: readonly MetricShot[]
  /** die rohe Karte vor `asOnPrintout` (Kontext für Abstände und Pausen) */
  context?: readonly MetricShot[]
  state?: ViewState
  target?: TargetImage
  /** die Seite eines Zeitraums: Scheiben der Familie, Zustand, Modell */
  period?: { cards: readonly PeriodCard[]; state: PeriodState; model: PeriodModel }
  /** Start (Plan N5): das Modell zum Nachrechnen */
  start?: { model: StartModel; cards: readonly PeriodCard[] }
  list?: {
    model: CardListModel
    query: ListQuery
    cards: readonly PeriodCard[]
    families: Record<string, string>
  }
  tools: typeof TOOLS
}

declare global {
  interface Window {
    __labor?: LaborHook
  }
}

// beim Laden festgehalten: Anker der Sprungleiste (#analysis …) ändern die Adresse während der Prüfung
const TEST_AT_LOAD = typeof location !== "undefined" && location.hash === "#pruefen"

/** läuft die Seite in der Skriptprüfung? (so, wie sie geladen wurde) */
export const underTest = () => TEST_AT_LOAD

/** den aktuellen Stand für die Skriptprüfung ablegen; außerhalb von #pruefen nichts */
export function exposeForTest(
  shots: readonly MetricShot[],
  state: ViewState,
  target: TargetImage,
  /** die rohe Karte vor `asOnPrintout`, wie Tabelle und Analyse sie bekommen */
  context: readonly MetricShot[]
) {
  if (underTest())
    window.__labor = { ...window.__labor, shots, context, state, target, tools: TOOLS }
}

/** den Stand der Seite eines Zeitraums für die Skriptprüfung ablegen; außerhalb von #pruefen nichts */
export function exposePeriodForTest(period: NonNullable<LaborHook["period"]>) {
  if (underTest()) window.__labor = { ...window.__labor, period, tools: TOOLS }
}

/** Start (Plan N5): Modell und Scheiben zum Nachrechnen */
export function exposeStartForTest(start: NonNullable<LaborHook["start"]>) {
  if (underTest()) window.__labor = { ...window.__labor, start, tools: TOOLS }
}

/** die Scheiben-Liste (Plan N2): Modell und Filter zum Nachrechnen */
export function exposeListForTest(list: NonNullable<LaborHook["list"]>) {
  if (underTest()) window.__labor = { ...window.__labor, list, tools: TOOLS }
}
