import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RULER_HINT, RulerMark, RulerReadout, useRuler, ValuesTable } from "./ChartRuler"

function Probe({ preset }: { preset: number | null }) {
  const { index, svgProps } = useRuler([10, 20, 30], 600, preset)
  return h("svg", svgProps, h("text", null, index === null ? "keine" : `Index ${index}`))
}

describe("Lineal als Baustein", () => {
  it("Zeile ohne Wahl: der Hinweis, gemeldet, ohne Knopf", () => {
    const html = renderToStaticMarkup(
      h(RulerReadout, { text: null, action: { label: "Auf der Scheibe", onClick: () => {} } })
    )
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain(RULER_HINT)
    expect(html).not.toContain("<button")
  })

  it("Zeile mit Wahl: die Werte und die Aktion", () => {
    const html = renderToStaticMarkup(
      h(RulerReadout, {
        text: "Schuss 5 · 9,7",
        action: { label: "Auf der Scheibe", onClick: () => {} },
      })
    )
    expect(html).toContain("Schuss 5 · 9,7")
    expect(html).toMatch(/<button type="button"[^>]*>Auf der Scheibe<\/button>/)
    expect(renderToStaticMarkup(h(RulerReadout, { text: "Schuss 5" }))).not.toContain("<button")
  })

  it("Markierung: senkrechte Linie ohne Zeigerereignisse", () => {
    const html = renderToStaticMarkup(
      h("svg", null, h(RulerMark, { x: 100.2, top: 10, bottom: 90 }))
    )
    expect(html).toMatch(
      /<line data-ruler="true" x1="100.5" x2="100.5" y1="10" y2="90"[^>]*pointer-events="none"/
    )
  })

  it("Tabelle: zugeklappt, mit Beschriftung, Kopf und Zeilen", () => {
    const html = renderToStaticMarkup(
      h(ValuesTable, {
        caption: "Wert je Schuss",
        columns: ["Schuss", "Wert"],
        rows: [
          ["1", "9,7"],
          ["2", "10,1"],
        ],
      })
    )
    expect(html).toMatch(/^<details data-values="true"/)
    expect(html).not.toContain("<details open")
    expect(html).toContain("<summary")
    expect(html).toContain("Werte als Tabelle")
    expect(html).toContain('<caption class="sr-only">Wert je Schuss</caption>')
    expect([...html.matchAll(/<th scope="col"/g)]).toHaveLength(2)
    expect([...html.matchAll(/<tr class="border-t/g)]).toHaveLength(2)
  })

  it("Hook: fokussierbar, senkrecht scrollbar, die Vorgabe der Scheibe gilt", () => {
    const html = renderToStaticMarkup(h(Probe, { preset: 1 }))
    expect(html).toContain('tabindex="0"')
    expect(html).toContain("touch-action:pan-y")
    expect(html).toContain("Index 1")
    expect(renderToStaticMarkup(h(Probe, { preset: null }))).toContain("keine")
  })
})
