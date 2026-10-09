// Die Karten je Reiter. Jeder Reiter liefert Karten mit Schlüssel und Breite; der Rahmen ordnet sie an
// (breite allein, schmale im Raster).

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { ReactNode } from "react"

import type { Layer } from "../../view-state"
import type { AnalysisInput } from "../input"
import { overviewCards } from "./OverviewTab"
import { positionCards } from "./PositionTab"
import { precisionCards } from "./PrecisionTab"
import { resultCards } from "./ResultTab"
import { timeCards } from "./TimeTab"

export type AnalysisTab = "overview" | "result" | "precision" | "position" | "time"

export interface CardContext {
  input: AnalysisInput
  /** Schalter „Erklärungen“ */
  explain: boolean
  /** Ebenen der Scheibe, etwa die Vertrauensellipse, die eine Karte schaltet */
  layers: Readonly<Record<Layer, boolean>>
  onToggleLayer: (layer: Layer) => void
  /** „?“ einer Karte: öffnet ihre Erklärung als Blatt (Plan Schritt 4, D3) */
  onHelp?: (id: string) => void
  /** der auf der Scheibe gewählte Schuss, wenn er zur Grundlage gehört: das Lineal steht auf ihm (Plan L1, D4) */
  chosenShot?: MetricShot | null
  /** „Auf der Scheibe“ im Lineal: diesen Schuss dort wählen und zu ihr springen */
  onShowShot?: (shot: MetricShot) => void
}

export interface CardSpec {
  key: string
  /** breite Karte: steht allein */
  wide?: boolean
  element: ReactNode
}

export type TabCards = (context: CardContext) => CardSpec[]

/** Karten je Reiter */
export const TAB_CARDS: Record<AnalysisTab, TabCards> = {
  overview: overviewCards,
  result: resultCards,
  precision: precisionCards,
  position: positionCards,
  time: timeCards,
}
