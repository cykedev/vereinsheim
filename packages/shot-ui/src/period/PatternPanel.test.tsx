import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { PatternPanel, type PatternState } from "./PatternPanel"
import { PatternTarget, type PatternView } from "./PatternTarget"
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

const render = (
  state: PatternState,
  choice: { view?: PatternView; onView?: (view: PatternView) => void } = { onView: () => {} }
) =>
  renderToStaticMarkup(
    createElement(PatternPanel, { state, target: LG_10M, onRetry: () => {}, ...choice })
  )
const drawn = (pattern: ReturnType<typeof periodPattern>, view: PatternView) =>
  renderToStaticMarkup(
    createElement(PatternTarget, { layer: pattern.picture, target: LG_10M, label: "", view })
  )
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
    expect(html).toContain('data-pattern-target="rings"')
    expect(html.match(/data-pattern-shot/g)).toHaveLength(3)
    expect(html).toContain('fill="var(--score-10)"')
    expect(html).toContain('fill="var(--score-9)"')
    expect(html).toContain('stroke-dasharray="2 2"')
    expect(html).toContain("Jeder Punkt ist ein Schuss.")
    expect(html).not.toContain("data-heat-legend")
  })

  it("ab 50 Schuss jeder Treffer in der Farbe der Dichte auf der echten Scheibe, mit Legende", () => {
    const flier = { id: "weit", atMs: 99, points: [{ xUm: 4000, yUm: 0, ring: 8 }] }
    const html = render({ status: "ready", pattern: periodPattern([...cards(10, 40), flier]) })
    expect(html).toContain('data-pattern-target="shots"')
    expect(html.match(/data-pattern-shot/g)).toHaveLength(401)
    expect(html).toContain('fill="var(--heat-5)"')
    expect(html).toContain('fill="var(--heat-0)"')
    expect(html).not.toContain("var(--score-")
    // die Scheibe wie auf der Seite einer Scheibe, Ringe und Ringzahlen über den Treffern
    expect(html).toContain('fill="var(--paper)"')
    expect(html).toContain('fill="var(--spiegel)"')
    expect(html.lastIndexOf("data-pattern-shot")).toBeLessThan(html.indexOf("data-ring="))
    expect(html).toContain("Jeder Punkt ist ein Schuss.")
    expect(html).toContain("data-heat-legend")
    expect(text(html)).not.toMatch(JARGON)
  })

  it("über 3.000 Schuss nur die Umrisse, ohne Knopf, wie beim Vergleichen", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(80, 40)) })
    expect(html).toContain('data-pattern-target="outlines"')
    expect(html).toContain('data-pattern-view="outlines"')
    expect(html.match(/data-outline="pattern"/g)).toHaveLength(2)
    expect(html).not.toContain("data-pattern-shot")
    expect(html).not.toContain('aria-label="Umrisse statt Treffer zeigen"')
    expect(html).toContain("Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10.")
    expect(html).not.toContain("data-heat-legend")
    expect(html).not.toContain("Jeder Punkt ist ein Schuss.")
  })

  it("Satz aus Lage und Form, Grundlage, die Mitte aller Schüsse und der Bereich, in dem sie sicher liegt", () => {
    const pattern = periodPattern(cards(10, 40))
    const html = render({ status: "ready", pattern })
    expect(html).toContain(
      "Über 400 Schuss aus 10 Scheiben. Der geviertelte Kreis ist die Mitte aller Schüsse. Der feine Rahmen um ihn zeigt, wo deine Mitte sicher liegt. Liegt die Mitte der Scheibe darin, ist ein Versatz noch nicht sicher."
    )
    // der Rahmen steht um die Mitte des Urteils, so breit wie der Bereich je Richtung
    const region = pattern.overTime.region!
    const mean = pattern.overTime.mean!
    const rect = html.match(/<g data-overlay="region">.*?<\/g>/)?.[0] ?? ""
    expect(rect).toContain(`width="${(2 * region.xUm) / 1000}"`)
    expect(rect).toContain(`height="${(2 * region.yUm) / 1000}"`)
    expect(rect).toContain(`x="${(mean.xUm - region.xUm) / 1000}"`)
    // erst die Lage, dann die Form
    const sentence = text(html.match(/<p data-pattern-sentence[^>]*>.*?<\/p>/)?.[0] ?? "")
    expect(sentence).toMatch(/^\s*Deine (Lage|Mitte) .*Die Gruppe /)
    expect(html).toContain("<title>Schwerpunkt</title>")
    expect(html).not.toContain('aria-label="Sicht"')
  })

  it("ohne Schuss mit Lage: kein Laden ohne Ende, sondern ein leeres Bild und was fehlt", () => {
    const html = render({ status: "ready", pattern: periodPattern([]) })
    expect(html).not.toContain("data-pattern-placeholder")
    expect(html).toContain("Für ein Urteil über die Lage fehlen noch Scheiben.")
    expect(html).toContain("Über 0 Schuss aus 0 Scheiben.")
    // ohne Urteil kein Rahmen und keine Erklärung dazu
    expect(html).not.toContain('data-overlay="region"')
    expect(html).not.toContain("Der feine Rahmen")
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

describe("Umrisse statt Dichte", () => {
  const BUTTON = 'aria-label="Umrisse statt Treffer zeigen"'

  it("ab 50 Schuss ein Knopf oben links, anfangs mit der Dichte", () => {
    const html = render({ status: "ready", pattern: periodPattern(cards(10, 40)) })
    expect(html).toContain(BUTTON)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('data-pattern-view="density"')
    expect(html).toContain("data-heat-legend")
    expect(html).not.toContain("Durchgezogen")
  })

  it("gewählt: Umrisse, Knopf gedrückt, Legende der Umrisse statt der Dichte", () => {
    const html = render(
      { status: "ready", pattern: periodPattern(cards(10, 40)) },
      { view: "outlines", onView: () => {} }
    )
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('data-pattern-view="outlines"')
    expect(html).toContain('data-pattern-legend="outlines"')
    expect(html).not.toContain("data-heat-legend")
    expect(html).not.toContain("Jeder Punkt ist ein Schuss.")
  })

  it("ohne `onView` kein Knopf, die Zeichnung folgt `view`", () => {
    const html = render(
      { status: "ready", pattern: periodPattern(cards(10, 40)) },
      { view: "outlines" }
    )
    expect(html).not.toContain(BUTTON)
    expect(html).toContain('data-pattern-view="outlines"')
  })

  it("über 3.000 Schuss bleiben es Umrisse, auch wenn die Dichte gewählt ist", () => {
    const pattern = periodPattern(cards(80, 40))
    expect(drawn(pattern, "density")).toContain('data-pattern-view="outlines"')
    expect(render({ status: "ready", pattern }, { view: "density", onView: () => {} })).toContain(
      'data-pattern-legend="outlines"'
    )
  })

  it("unter 50 Schuss kein Knopf: Jeder Treffer steht in seiner Ringfarbe", () => {
    const few = periodPattern(cards(1, 40))
    expect(render({ status: "ready", pattern: few })).not.toContain(BUTTON)
    // auch wer die Umrisse verlangt, bekommt die Treffer
    const html = drawn(few, "outlines")
    expect(html).toContain('data-pattern-view="density"')
    expect(html.match(/data-pattern-shot/g)).toHaveLength(40)
    expect(html).not.toContain("data-outline=")
  })

  for (const [name, pattern] of [
    ["mit dem Knopf", periodPattern(cards(10, 40))],
    ["über 3.000 Schuss", periodPattern(cards(80, 40))],
  ] as const) {
    it(`${name} die Umrisse wie beim Vergleichen, unter den Ringen`, () => {
      const html = drawn(pattern, "outlines")
      expect(html).toContain('data-pattern-view="outlines"')
      expect(html).not.toContain("data-pattern-shot")
      expect(html).not.toContain("var(--heat-")
      // gestrichelt 9 von 10, durchgezogen und getönt die Hälfte, in der Farbe der Seite A
      expect(html.match(/data-outline="pattern"/g)).toHaveLength(2)
      expect(html.match(/data-dashed="true"/g)).toHaveLength(1)
      expect(html).toContain('fill="var(--compare-a)" fill-opacity="0.4"')
      expect(html.lastIndexOf("data-outline=")).toBeLessThan(html.indexOf("data-ring="))
      expect(html).toContain("<title>Schwerpunkt</title>")
    })
  }
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
