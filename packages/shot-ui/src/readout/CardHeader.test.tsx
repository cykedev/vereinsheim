import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardHeader } from "./CardHeader"

const render = (props: Partial<Parameters<typeof CardHeader>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CardHeader, {
      title: "Luftpistole 10 m",
      meta: ["40 Schuss mit Probe", "2. Oktober"],
      result: createElement("p", null, "ERGEBNIS"),
      sentence: "Die Lage ist echt.",
      ...props,
    })
  )

describe("Kopf der Scheibe (D2)", () => {
  it("Titel, Metazeile, auf dem Telefon das Ergebnis, dann der Satz", () => {
    const html = render()
    expect(html).toMatch(/<h1[^>]*>Luftpistole 10 m<\/h1>/)
    expect(html).toContain("40 Schuss mit Probe · 2. Oktober")
    const order = ["<h1", "ERGEBNIS", "data-sentence"].map((m) => html.indexOf(m))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("ab 768 px im Raster der Seite über der Scheibe, das Ergebnis steht dann als Box daneben", () => {
    const html = render()
    expect(html).toMatch(
      /data-card-header="[^"]*" class="grid gap-3 md:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(0,0\.9fr\)\] md:gap-x-7/
    )
    expect(html).toContain('<div class="md:hidden"><p>ERGEBNIS</p></div>')
    expect(html).toMatch(/data-sentence="[^"]*" class="[^"]*md:col-start-1/)
  })

  it("ohne Satz kein leerer Absatz, ohne Ergebnis kein leerer Platz", () => {
    expect(render({ sentence: null })).not.toContain("data-sentence")
    expect(render({ result: null })).not.toContain("md:hidden")
  })
})
