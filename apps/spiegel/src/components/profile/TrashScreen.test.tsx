import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TrashScreen } from "./TrashScreen"

const item = {
  cardId: "c1",
  when: "Di 13.10.2026 · 19:12",
  family: "Luftpistole",
  result: "376 Ringe",
  left: "noch 29 Tage",
}
const blocked = [
  { key: "a", when: "Di 01.09.2026 · 19:05", label: "endgültig gelöscht" },
  { key: "b", when: "Do 03.09.2026 · 18:40", label: "als „nicht meine“ gemeldet" },
]
const render = (props: Parameters<typeof TrashScreen>[0]) =>
  renderToStaticMarkup(createElement(TrashScreen, props))

describe("Papierkorb", () => {
  it("je Scheibe Abend, Familie, Ergebnis, Tage und beide Knöpfe", () => {
    const html = render({ items: [item], blocked: [] })
    for (const text of [item.when, "Luftpistole · 376 Ringe", "noch 29 Tage"])
      expect(html).toContain(text)
    expect(html).toContain(">Wiederherstellen</button>")
    expect(html).toContain(">Endgültig löschen</button>")
    expect(html).not.toContain("data-trash-blocked")
    expect(html).not.toContain("data-trash-empty")
  })

  it("was nicht wiederkommt, ohne Knopf; leer mit Hinweis, wo man löscht", () => {
    const html = render({ items: [], blocked })
    expect(html).toContain("data-trash-empty")
    expect(html).toContain("Der Papierkorb ist leer")
    const section = html.slice(html.indexOf("data-trash-blocked"))
    expect(section).toContain("Kommt nicht von selbst wieder")
    expect(section).toContain("Ein Admin kann eine Meldung „nicht meine“ wieder aufheben.")
    expect(section).toContain("endgültig gelöscht")
    expect(section).toContain("als „nicht meine“ gemeldet")
    expect(section).not.toContain("<button")
  })
})
