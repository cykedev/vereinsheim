import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { PatternPanel, type PatternState } from "./PatternPanel"
import { PeriodChartBar } from "./PeriodChartBar"

/**
 * gleichmäßig auf Ringen verteilte Schüsse, versetzt um (x | y) und je Scheibe ein wenig anders (sonst lägen alle
 * Mitten auf einem Punkt): ohne Zufall, mit fester Form
 */
function cards(count: number, shots: number, base = { xUm: 0, yUm: 0 }): PatternCard[] {
  return Array.from({ length: count }, (_, c) => ({
    id: `c${c}`,
    atMs: c,
    points: Array.from({ length: shots }, (_, i) => {
      const r = 400 + ((i * 7) % 5) * 300
      const a = (i * 2 * Math.PI) / shots + c
      const offset = { xUm: base.xUm + ((c % 3) - 1) * 40, yUm: base.yUm + ((c % 2) * 2 - 1) * 30 }
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
  it("unter 50 Schuss jeder Schuss in Kalibergröße und Ringfarbe", () => {
    const pattern = periodPattern([
      {
        id: "a",
        atMs: 0,
        points: [
          { xUm: 0, yUm: 0, ring: 10 },
          { xUm: 3000, yUm: 0, ring: 9 },
          { xUm: 0, yUm: 3000, ring: null },
        ],
      },
    ])
    const html = render({ status: "ready", pattern })
    expect(html).toContain('data-pattern-target="points"')
    expect(html.match(/data-pattern-shot/g)).toHaveLength(3)
    expect(html).toContain('fill="var(--score-10)"')
    expect(html).toContain('fill="var(--score-9)"')
    expect(html).toContain('stroke-dasharray="2 2"')
    expect(html).toContain("Jeder Punkt ist ein Schuss.")
    expect(html).not.toContain("data-heat-legend")
  })

  it("ab 50 Schuss die Heatmap in sechs Bändern auf der echten Scheibe, mit Legende", () => {
    // auch ein Schuss weit draußen steht nicht einzeln da
    const flier = { id: "weit", atMs: 99, points: [{ xUm: 4000, yUm: 0, ring: 8 }] }
    const html = render({ status: "ready", pattern: periodPattern([...cards(10, 40), flier]) })
    expect(html).toContain('data-pattern-target="density"')
    for (const band of [1, 2, 3, 4, 5, 6]) expect(html).toContain(`data-pattern-band="${band}"`)
    // nur die Heatmap, keine einzelnen Treffer
    expect(html).not.toContain("data-pattern-shot")
    expect(html).toContain('fill="var(--paper)"')
    expect(html).toContain('fill="var(--spiegel)"')
    // die Scheibe wie auf der Seite einer Scheibe, die Ringe und Ringzahlen über den Bändern
    expect(html).toContain("data-ring=")
    expect(html.lastIndexOf("data-pattern-band")).toBeLessThan(html.indexOf("data-ring="))
    expect(html).toContain("data-heat-legend")
    expect(html).toContain("selten")
    expect(text(html)).not.toMatch(JARGON)
  })

  it("Satz aus Lage und Form, Grundlage und die Mitte aller Schüsse", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(10, 40)) })
    expect(html).toContain(
      "Über 400 Schuss aus 10 Scheiben. Der geviertelte Kreis ist die Mitte aller Schüsse."
    )
    // erst die Lage, dann die Form
    const sentence = text(html.match(/<p data-pattern-sentence[^>]*>.*?<\/p>/)?.[0] ?? "")
    expect(sentence).toMatch(/^\s*Deine Lage .*Die Gruppe /)
    expect(html).toContain("<title>Schwerpunkt</title>")
    expect(html).not.toContain('aria-label="Sicht"')
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
