import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"

import { PatternPanel, type PatternState } from "./PatternPanel"
import { ringLabels } from "./PatternTarget"
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

  it("ab 50 Schuss die Heatmap in fünf Bändern auf der ruhigen Scheibe, mit Legende", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(10, 40)) })
    expect(html).toContain('data-pattern-target="density"')
    for (const band of [1, 2, 3, 4, 5]) expect(html).toContain(`data-pattern-band="${band}"`)
    expect(html).toContain('fill="var(--heat-paper)"')
    expect(html).toContain("data-heat-rings")
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

describe("Ringe über der Heatmap", () => {
  it("Luftpistole: der Rand des Spiegels kräftiger, Ringzahlen in den Bändern", () => {
    const wide = cards(10, 40).map((c) => ({
      ...c,
      points: c.points.map((p) => ({ xUm: p.xUm * 15, yUm: p.yUm * 15 })),
    }))
    const html = renderToStaticMarkup(
      createElement(PatternPanel, {
        state: { status: "ready", pattern: periodPattern(wide) },
        target: LP_10M,
        onRetry: () => {},
      })
    )
    expect(html).toContain("data-mirror-edge")
    expect(html).toMatch(/data-ring-label="\d"/)
  })
})

describe("ringLabels", () => {
  it("die Mitte jedes Bands bei 3 und 9 Uhr, nur wo es in den Ausschnitt passt und breit genug ist", () => {
    // Luftpistole: Ringbreite 8 mm, Zehn 11,5 mm; Ausschnitt ±40 mm, Schrift 2,56 mm
    const labels = ringLabels(LP_10M, { x: -40, y: -40, w: 80 }, 2.56)
    expect(labels.map((l) => l.ring)).toEqual([6, 6, 7, 7, 8, 8, 9, 9])
    expect(labels[0].xMm).toBeCloseTo(33.75, 6)
    expect(labels[1].xMm).toBeCloseTo(-33.75, 6)
  })
})
