import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardPage } from "./CardPage"

const html = renderToStaticMarkup(
  h(CardPage, {
    header: h("p", null, "KOPF"),
    nav: h("nav", null, "LEISTE"),
    target: h("p", null, "SCHEIBE"),
    aside: h("p", null, "SEITE"),
    sections: [
      { id: "zahlen", node: h("p", null, "ZAHLEN") },
      { id: "schuesse", node: h("p", null, "SCHÜSSE") },
      { id: "analyse", node: h("p", null, "ANALYSE") },
    ],
  })
)

describe("Rahmen der Seite (D2, D5)", () => {
  it("auf dem Telefon eine Spalte: Kopf, Leiste, Scheibe, Seite, Abschnitte", () => {
    const order = ["KOPF", "LEISTE", "SCHEIBE", "SEITE", "ZAHLEN", "SCHÜSSE", "ANALYSE"].map((t) =>
      html.indexOf(t)
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("jeder Abschnitt mit Anker-Id, data-section und Abstand für die Leiste", () => {
    // der Anker der Scheibe sitzt auf dem Raster, das nicht klebt; die Scheibe selbst trägt data-section
    expect(html).toMatch(
      /<div id="scheibe" class="[^"]*scroll-mt-14[^"]*"><div data-section="scheibe" class="[^"]*scroll-mt-14/
    )
    for (const id of ["zahlen", "schuesse", "analyse"]) {
      expect(html).toMatch(
        new RegExp(`<div[^>]*id="${id}"[^>]*data-section="${id}"[^>]*class="[^"]*scroll-mt-14`)
      )
    }
  })

  it("ab 768 px zwei Spalten, die Scheibe bleibt links unter der Leiste stehen", () => {
    expect(html).toContain("md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]")
    expect(html).toMatch(/data-section="scheibe"[^>]*class="[^"]*md:sticky md:top-14 md:self-start/)
  })
})
