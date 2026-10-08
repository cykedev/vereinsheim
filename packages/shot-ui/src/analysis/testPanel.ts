// Hilfen für die Tests der Reiter: einen Reiter als Markup zeichnen und eine Karte darin lesen. Nur für
// Tests, nicht exportiert.

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { LP_10M, type TargetImage } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { initialViewState, type Layer } from "../view-state"
import { AnalysisPanel } from "./AnalysisPanel"
import type { AnalysisTab } from "./tabs"
import { fortyCard } from "./testCard"

export interface RenderOptions {
  shots?: readonly MetricShot[]
  scoring?: "decimal" | "rings"
  target?: TargetImage
  explain?: boolean
  layers?: Partial<Record<Layer, boolean>>
  onToggleLayer?: (layer: Layer) => void
  onHelp?: (id: string) => void
}

/** ein Reiter der Analyse als Markup; ohne Angaben die Beispielkarte „40 Schuss“ (LP) in Zehnteln */
export function renderTab(tab: AnalysisTab, options: RenderOptions = {}): string {
  const state = initialViewState({ scoring: options.scoring ?? "decimal" })
  return renderToStaticMarkup(
    createElement(AnalysisPanel, {
      shots: options.shots ?? fortyCard(options.target),
      state: { ...state, layers: { ...state.layers, ...options.layers } },
      target: options.target ?? LP_10M,
      tab,
      onTab: () => {},
      explain: options.explain ?? false,
      onToggleLayer: options.onToggleLayer ?? (() => {}),
      onHelp: options.onHelp ?? (() => {}),
    })
  )
}

/** Markup einer Karte (`data-card`) bis zu ihrem Ende */
export function cardHtml(html: string, id: string): string {
  const start = html.indexOf(`data-card="${id}"`)
  if (start < 0) throw new Error(`Keine Karte ${id}`)
  return html.slice(start, html.indexOf("</article>", start))
}

/** Text einer Karte ohne Markup, Leerraum zusammengefasst */
export const cardText = (html: string, id: string) =>
  cardHtml(html, id)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
