import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Observation } from "../analysis/observations"
import { CardHeader } from "./CardHeader"

const OBSERVATIONS: Observation[] = [
  { icon: "position", notable: true, text: "Die Lage ist echt." },
  { icon: "outlier", notable: true, text: "Schuss 27 fällt als Ausreißer aus der Gruppe." },
]

const render = (props: Partial<Parameters<typeof CardHeader>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CardHeader, {
      title: "Luftpistole 10 m",
      meta: ["40 Schuss mit Probe", "2. Oktober"],
      result: createElement("p", null, "ERGEBNIS"),
      observations: OBSERVATIONS,
      onMore: () => {},
      ...props,
    })
  )

describe("Kopf der Scheibe", () => {
  it("Titel, Metazeile, auf dem Telefon das Ergebnis, dann die Beobachtungen", () => {
    const html = render()
    expect(html).toMatch(/<h1[^>]*>Luftpistole 10 m<\/h1>/)
    expect(html).toContain("40 Schuss mit Probe · 2. Oktober")
    const order = ["<h1", "ERGEBNIS", "data-key-observations"].map((m) => html.indexOf(m))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("je Beobachtung ein Eintrag mit Symbol und Satz, in der gegebenen Reihenfolge", () => {
    const html = render()
    expect([...html.matchAll(/<li data-observation="([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "position",
      "outlier",
    ])
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2)
    expect(html).toContain("Die Lage ist echt.")
    expect(html).toContain("Schuss 27 fällt als Ausreißer aus der Gruppe.")
  })

  it("auf dem Telefon nur die erste (ein Satz auf dem ersten Bildschirm), ab 768 px alle", () => {
    const items = [...render().matchAll(/<li data-observation="[a-z]+" class="([^"]*)"/g)].map(
      (m) => m[1]
    )
    expect(items).toHaveLength(2)
    expect(items[0]).not.toContain("max-md:hidden")
    expect(items[1]).toContain("max-md:hidden")
    expect(render()).toMatch(/<ul aria-label="Wichtigste Beobachtungen"/)
  })

  it("„Alle Beobachtungen“ nur mit `onMore`, als Knopf; das „›“ liest der Screenreader nicht", () => {
    expect(render()).toMatch(
      /<button type="button" data-more-observations="true"[^>]*>Alle Beobachtungen <span aria-hidden="true">›<\/span><\/button>/
    )
    expect(render({ onMore: undefined })).not.toContain("data-more-observations")
  })

  it("ab 768 px im Raster der Seite über der Scheibe, das Ergebnis steht dann als Box daneben", () => {
    const html = render()
    expect(html).toMatch(
      /data-card-header="[^"]*" class="grid gap-3 md:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(0,0\.9fr\)\] md:gap-x-7/
    )
    expect(html).toContain('<div class="md:hidden"><p>ERGEBNIS</p></div>')
    expect(html).toMatch(/data-key-observations="[^"]*" class="[^"]*md:col-start-1/)
  })

  it("ohne Beobachtungen weder Liste noch Knopf, ohne Ergebnis kein leerer Platz", () => {
    const bare = render({ observations: [] })
    expect(bare).not.toContain("data-key-observations")
    expect(bare).not.toContain("data-more-observations")
    expect(render({ result: null })).not.toContain('<div class="md:hidden">')
  })
})
