import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { PageHeader } from "./page-header"

const classOf = (html: string, slot: string) =>
  html.match(new RegExp(`data-slot="${slot}" class="([^"]*)"`))?.[1].split(" ") ?? []

describe("Karte in Design 2", () => {
  const html = renderToStaticMarkup(
    h(Card, null, h(CardHeader, null, h(CardTitle, null, "Titel")), h(CardContent, null, "Inhalt"))
  )

  it("16 px Rand, 12 px Abstand, große Radien statt der Maße von ui/card", () => {
    const card = classOf(html, "card")
    expect(card).toEqual(expect.arrayContaining(["py-4", "gap-3", "rounded-2xl"]))
    expect(card).not.toContain("py-6")
    expect(card).not.toContain("gap-6")
    expect(classOf(html, "card-header")).toContain("px-4")
    expect(classOf(html, "card-content")).toEqual(["px-4"])
    expect(classOf(html, "card-title")).toContain("text-[15px]")
  })

  it("eine Klasse am Aufruf gewinnt", () => {
    const own = renderToStaticMarkup(h(Card, { className: "py-0" }, "x"))
    expect(classOf(own, "card")).toContain("py-0")
    expect(classOf(own, "card")).not.toContain("py-4")
  })
})

describe("Seitenkopf in Design 2", () => {
  it("Titel in der Schrift der Marke, Satz und Aktion", () => {
    const html = renderToStaticMarkup(
      h(PageHeader, {
        title: "Tagebuch",
        description: "Alle Einheiten",
        action: h("a", null, "Neu"),
      })
    )
    expect(html).toMatch(/<h1 class="font-display[^"]*">Tagebuch<\/h1>/)
    expect(html).toContain("Alle Einheiten")
    expect(html).toContain("<a>Neu</a>")
  })
})
