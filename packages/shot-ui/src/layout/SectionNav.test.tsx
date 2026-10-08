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
      "zahlen",
      "schuesse",
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

  it("klebt oben, deckt den Inhalt darunter, Leiste scrollt in sich", () => {
    expect(html).toMatch(/<nav[^>]*class="[^"]*sticky top-0 z-20[^"]*bg-background/)
    expect(html).toContain("overflow-x-auto")
  })
})

describe("aktiver Abschnitt", () => {
  const box = (id: "scheibe" | "zahlen" | "schuesse" | "analyse", top: number) => ({ id, top })

  it("der späteste Abschnitt, der oberhalb von 45 % der Fensterhöhe begonnen hat", () => {
    // Desktop: die feste Scheibe oben, rechts ist die Analyse bis unter die Leiste gescrollt
    expect(
      activeSection(
        [box("scheibe", 56), box("zahlen", -710), box("schuesse", -310), box("analyse", 56)],
        900
      )
    ).toBe("analyse")
    // Desktop: rechts beginnen die Zahlen gerade über der Linie
    expect(
      activeSection(
        [box("scheibe", 56), box("zahlen", 300), box("schuesse", 900), box("analyse", 1400)],
        900
      )
    ).toBe("zahlen")
  })

  it("über den Serien bleibt die Scheibe aktiv; ganz oben noch keiner", () => {
    expect(
      activeSection([box("scheibe", -200), box("zahlen", 600), box("schuesse", 1300)], 900)
    ).toBe("scheibe")
    expect(activeSection([box("scheibe", 850), box("zahlen", 1700)], 900)).toBeNull()
    // am Ende der Seite der letzte, auch wenn er die Linie nicht erreicht (kurze Analyse)
    expect(
      activeSection([box("scheibe", 56), box("schuesse", 100), box("analyse", 432)], 900, true)
    ).toBe("analyse")
  })
})
