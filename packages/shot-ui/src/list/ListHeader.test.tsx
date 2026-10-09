import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ListHeader } from "./ListHeader"

describe("Kopf der Scheiben-Liste (Plan N2, Review)", () => {
  it("Titel wie im Zeitraum, Familie und Zahl der Scheiben, darunter die Filter", () => {
    const html = renderToStaticMarkup(
      h(ListHeader, {
        familyLabel: "Luftgewehr",
        cards: 81,
        controls: h("div", { "data-controls": true }),
      })
    )
    expect(html).toMatch(/<h1 class="font-display[^"]*font-bold[^"]*">Scheiben<\/h1>/)
    expect(html).toContain(">Luftgewehr · 81 Scheiben<")
    expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf("data-controls"))
  })

  it("eine Scheibe in der Einzahl", () => {
    expect(renderToStaticMarkup(h(ListHeader, { familyLabel: "Luftpistole", cards: 1 }))).toContain(
      ">Luftpistole · 1 Scheibe<"
    )
  })
})
