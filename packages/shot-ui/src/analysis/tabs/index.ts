// Die Karten je Reiter. Jeder Reiter liefert Karten mit Schlüssel und Breite; der Rahmen ordnet sie an
// (breite allein, schmale im Raster).

import type { ReactNode } from "react"

import type { Layer } from "../../view-state"
import type { AnalysisInput } from "../input"
import { overviewCards } from "./OverviewTab"

export type AnalysisTab = "overview" | "result" | "precision" | "position" | "time" | "sighters"

export interface CardContext {
  input: AnalysisInput
  /** Schalter „Erklärungen“ */
  explain: boolean
  /** Ebenen der Scheibe, etwa die Vertrauensellipse, die eine Karte schaltet */
  layers: Readonly<Record<Layer, boolean>>
  onToggleLayer: (layer: Layer) => void
}

export interface CardSpec {
  key: string
  /** breite Karte: steht allein */
  wide?: boolean
  element: ReactNode
}

export type TabCards = (context: CardContext) => CardSpec[]

/** Karten je Reiter; die Reiter füllen die Tasks 5 bis 13 des Plans */
export const TAB_CARDS: Record<AnalysisTab, TabCards> = {
  overview: overviewCards,
  result: () => [],
  precision: () => [],
  position: () => [],
  time: () => [],
  sighters: () => [],
}
