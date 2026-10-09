import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SectionNav } from "./SectionNav"
import { activeSection } from "./useActiveSection"

describe("Sprungleiste (D1)", () => {
  const html = renderToStaticMarkup(createElement(SectionNav, { active: "shots" }))

  it("vier Anker in der Reihenfolge der Seite", () => {
    expect([...html.matchAll(/<a href="#([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "target",
      "shots",
      "numbers",
      "analysis",
    ])
    expect(html).toMatch(/^<nav aria-label="Abschnitte"/)
  })

  it("genau der aktive Abschnitt trägt aria-current", () => {
    expect([...html.matchAll(/aria-current="location"/g)]).toHaveLength(1)
    expect(html).toMatch(/<a href="#shots" aria-current="location"/)
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
  const box = (id: "target" | "numbers" | "shots" | "analysis", top: number) => ({ id, top })

  it("der späteste Abschnitt, der die Leiste erreicht hat", () => {
    // Desktop: die feste Scheibe oben, die Analyse in voller Breite bis unter die Leiste gescrollt
    expect(
      activeSection([
        box("target", -400),
        box("shots", -300),
        box("numbers", -250),
        box("analysis", 56),
      ])
    ).toBe("analysis")
    // Desktop: rechts kommt die Schusstabelle an der Leiste an, die Scheibe klebt daneben
    expect(
      activeSection([
        box("target", 56),
        box("shots", 90),
        box("numbers", 700),
        box("analysis", 1000),
      ])
    ).toBe("shots")
  })

  it("ein kurzer Abschnitt nach dem Sprung ist aktiv, auch wenn der nächste schon im oberen Drittel beginnt", () => {
    // „Zahlen“ in voller Breite, 290 px hoch, im Fenster von 900 px: die Analyse beginnt bei 346 px
    expect(
      activeSection([
        box("target", -700),
        box("shots", -500),
        box("numbers", 56),
        box("analysis", 346),
      ])
    ).toBe("numbers")
    // knapp vor der Leiste zählt er noch nicht
    expect(
      activeSection([
        box("target", -700),
        box("shots", -500),
        box("numbers", 120),
        box("analysis", 410),
      ])
    ).toBe("shots")
  })

  it("über den Serien bleibt die Scheibe aktiv; ganz oben die Scheibe, am Ende der letzte", () => {
    expect(activeSection([box("target", -200), box("shots", 600), box("numbers", 1300)])).toBe(
      "target"
    )
    expect(activeSection([box("target", 300), box("shots", 1700)])).toBe("target")
    expect(activeSection([])).toBeNull()
    // am Ende der Seite der letzte, auch wenn er die Leiste nicht erreicht (kurze Analyse)
    expect(activeSection([box("target", 56), box("shots", 100), box("analysis", 432)], true)).toBe(
      "analysis"
    )
  })
})
