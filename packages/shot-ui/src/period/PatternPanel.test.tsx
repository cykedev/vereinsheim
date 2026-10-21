import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { PatternPanel, type PatternState } from "./PatternPanel"
import { PeriodChartBar } from "./PeriodChartBar"

/** gleichmäßig auf Ringen verteilte Schüsse, versetzt um (x | y): ohne Zufall, mit fester Form */
function cards(count: number, shots: number, offset = { xUm: 0, yUm: 0 }): PatternCard[] {
  return Array.from({ length: count }, (_, c) => ({
    id: `c${c}`,
    atMs: c,
    points: Array.from({ length: shots }, (_, i) => {
      const r = 400 + ((i * 7) % 5) * 300
      const a = (i * 2 * Math.PI) / shots + c
      return {
        xUm: offset.xUm + Math.round(r * Math.cos(a)),
        yUm: offset.yUm + Math.round(r * Math.sin(a)),
      }
    }),
  }))
}

const render = (state: PatternState) =>
  renderToStaticMarkup(createElement(PatternPanel, { state, target: LG_10M, onRetry: () => {} }))
const text = (html: string) => html.replace(/<[^>]+>/g, " ")
const JARGON = /σ|Hotelling|Mauchly|Rayleigh|Median|95 ?%|\b[Uu]nklar\b/

describe("PatternPanel", () => {
  it("unter 300 Schuss jeder Schuss als Punkt, mit Satz, Legende und Grundlage", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(7, 40)) })
    expect(html).toContain('data-pattern-target="points"')
    expect(html.match(/<circle[^>]*fill-opacity="0.5"/g)).toHaveLength(280)
    expect(html).toContain("Jeder Punkt ist ein Schuss.")
    expect(html).toContain("Über 280 Schuss aus 7 Scheiben.")
    expect(html).toContain("Deine Gruppe zieht in keine klare Richtung.")
    expect(text(html)).not.toMatch(JARGON)
  })

  it("ab 300 Schuss die Dichte als zwei Flächen", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(10, 40)) })
    expect(html).toContain('data-pattern-target="density"')
    expect(html).toContain('data-pattern-area="outer"')
    expect(html).toContain('data-pattern-area="inner"')
    expect(html).toContain("Innen liegt die Hälfte deiner Schüsse, außen neun von zehn.")
    expect(text(html)).not.toMatch(JARGON)
  })

  it("das Bild trägt den Satz als Namen, Form ist die Vorgabe", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(10, 40)) })
    expect(html).toContain('data-pattern-panel="form"')
    expect(html).toContain('aria-label="Deine Gruppe zieht in keine klare Richtung."')
    expect(html).toContain("Jede Scheibe ist auf ihre eigene Mitte geschoben.")
  })

  it("lädt es noch oder ging es schief, steht ein Platz gleicher Größe da", () => {
    const loading = render({ status: "loading" })
    expect(loading).toContain('data-pattern-placeholder="true"')
    expect(loading).toContain("Trefferbild wird gerechnet …")
    const failed = render({ status: "error" })
    expect(failed).toContain('data-pattern-placeholder="true"')
    expect(failed).toContain("Das Trefferbild ließ sich nicht laden.")
    expect(failed).toContain("Noch einmal")
  })
})

describe("PeriodChartBar mit Hauptbild", () => {
  const props = {
    metric: "result.decimalMean" as const,
    view: "cards" as const,
    onMetric: () => {},
    onView: () => {},
    onHelp: () => {},
  }

  it("ohne `onShow` wie bisher, ohne Umschalter", () => {
    expect(renderToStaticMarkup(createElement(PeriodChartBar, props))).not.toContain("Trefferbild")
  })

  it("mit Trefferbild nur der Umschalter und sein „?“, ohne Kennzahl", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodChartBar, {
        ...props,
        show: "target",
        onShow: () => {},
        onPatternHelp: () => {},
      })
    )
    expect(html).toContain("Trefferbild")
    expect(html).toContain('data-help="langzeit-trefferbild"')
    expect(html).not.toContain('aria-label="Kennzahl"')
  })

  it("mit Verlauf der Umschalter in einer eigenen Zeile über der Kennzahl", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodChartBar, { ...props, show: "history", onShow: () => {} })
    )
    expect(html.indexOf('aria-label="Hauptbild"')).toBeLessThan(
      html.indexOf('aria-label="Kennzahl"')
    )
  })
})
