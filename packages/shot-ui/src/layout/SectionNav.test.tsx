import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SectionNav } from "./SectionNav"
import { activeSection } from "./useActiveSection"

describe("Sprungleiste (D1)", () => {
  const html = renderToStaticMarkup(createElement(SectionNav, { active: "schuesse" }))

  it("vier Anker in der Reihenfolge der Seite", () => {
    expect([...html.matchAll(/<a href="#([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "scheibe",
      "schuesse",
      "zahlen",
      "analyse",
    ])
    expect(html).toMatch(/^<nav aria-label="Abschnitte"/)
  })

  it("genau der aktive Abschnitt trägt aria-current", () => {
    expect([...html.matchAll(/aria-current="location"/g)]).toHaveLength(1)
    expect(html).toMatch(/<a href="#schuesse" aria-current="location"/)
    const none = renderToStaticMarkup(createElement(SectionNav, { active: null }))
    expect(none).not.toContain("aria-current")
  })

  it("klebt oben, deckt den Inhalt darunter; auf dem Telefon vier gleiche Felder, nie angeschnitten", () => {
    expect(html).toMatch(/<nav[^>]*class="[^"]*sticky top-0 z-20[^"]*bg-background/)
    expect(html).toContain("max-sm:grid-cols-4")
    expect(html).not.toContain("overflow-x-auto")
  })
})

describe("aktiver Abschnitt", () => {
  const box = (id: "scheibe" | "zahlen" | "schuesse" | "analyse", top: number) => ({ id, top })

  it("der späteste Abschnitt, der die Leiste erreicht hat", () => {
    // Desktop: die feste Scheibe oben, die Analyse in voller Breite bis unter die Leiste gescrollt
    expect(
      activeSection([
        box("scheibe", -400),
        box("schuesse", -300),
        box("zahlen", -250),
        box("analyse", 56),
      ])
    ).toBe("analyse")
    // Desktop: rechts kommt die Schusstabelle an der Leiste an, die Scheibe klebt daneben
    expect(
      activeSection([
        box("scheibe", 56),
        box("schuesse", 90),
        box("zahlen", 700),
        box("analyse", 1000),
      ])
    ).toBe("schuesse")
  })

  it("ein kurzer Abschnitt nach dem Sprung ist aktiv, auch wenn der nächste schon im oberen Drittel beginnt", () => {
    // „Zahlen“ in voller Breite, 290 px hoch, im Fenster von 900 px: die Analyse beginnt bei 346 px
    expect(
      activeSection([
        box("scheibe", -700),
        box("schuesse", -500),
        box("zahlen", 56),
        box("analyse", 346),
      ])
    ).toBe("zahlen")
    // knapp vor der Leiste zählt er noch nicht
    expect(
      activeSection([
        box("scheibe", -700),
        box("schuesse", -500),
        box("zahlen", 120),
        box("analyse", 410),
      ])
    ).toBe("schuesse")
  })

  it("über den Serien bleibt die Scheibe aktiv; ganz oben die Scheibe, am Ende der letzte", () => {
    expect(activeSection([box("scheibe", -200), box("schuesse", 600), box("zahlen", 1300)])).toBe(
      "scheibe"
    )
    expect(activeSection([box("scheibe", 300), box("schuesse", 1700)])).toBe("scheibe")
    expect(activeSection([])).toBeNull()
    // am Ende der Seite der letzte, auch wenn er die Leiste nicht erreicht (kurze Analyse)
    expect(
      activeSection([box("scheibe", 56), box("schuesse", 100), box("analyse", 432)], true)
    ).toBe("analyse")
  })
})
