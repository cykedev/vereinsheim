import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PERIOD_SECTIONS } from "./sections"
import { SectionNav } from "./SectionNav"
import { activeSection } from "./useActiveSection"

describe("Sprungleiste", () => {
  const html = renderToStaticMarkup(createElement(SectionNav, { active: "shots" }))

  it("drei Anker in der Reihenfolge der Seite (ohne „Zahlen“)", () => {
    expect([...html.matchAll(/<a href="#([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "target",
      "shots",
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

  it("klebt oben, deckt den Inhalt darunter; auf dem Telefon gleiche Felder je Abschnitt, nie angeschnitten", () => {
    expect(html).toMatch(/<nav[^>]*class="[^"]*sticky top-0 z-20[^"]*bg-background/)
    expect(html).toContain("max-sm:grid-cols-3")
    expect(html).not.toContain("max-sm:grid-cols-4")
    expect(html).not.toContain("overflow-x-auto")
    // der Zeitraum hat weiter vier
    const period = renderToStaticMarkup(
      createElement(SectionNav, { active: null, sections: PERIOD_SECTIONS })
    )
    expect(period).toContain("max-sm:grid-cols-4")
    expect(period).not.toContain("max-sm:grid-cols-3")
  })
})

describe("aktiver Abschnitt", () => {
  const box = (id: string, top: number) => ({ id, top })

  it("der späteste Abschnitt, der die Leiste erreicht hat", () => {
    // Desktop, Scheibe: die feste Scheibe oben, die Analyse in voller Breite bis unter die Leiste gescrollt
    expect(activeSection([box("target", -400), box("shots", -300), box("analysis", 56)])).toBe(
      "analysis"
    )
    // Desktop, Scheibe: rechts kommt die Schusstabelle an der Leiste an, die Scheibe klebt daneben
    expect(activeSection([box("target", 56), box("shots", 90), box("analysis", 1000)])).toBe(
      "shots"
    )
  })

  it("ein kurzer Abschnitt nach dem Sprung ist aktiv, auch wenn der nächste schon im oberen Drittel beginnt", () => {
    // Zeitraum: „Zahlen“ in voller Breite, 290 px hoch, im Fenster von 900 px; die Analyse beginnt bei 346 px
    // (die Scheibe hat keinen Abschnitt „Zahlen“)
    expect(
      activeSection([
        box("history", -700),
        box("cards", -500),
        box("numbers", 56),
        box("analysis", 346),
      ])
    ).toBe("numbers")
    // knapp vor der Leiste zählt er noch nicht
    expect(
      activeSection([
        box("history", -700),
        box("cards", -500),
        box("numbers", 120),
        box("analysis", 410),
      ])
    ).toBe("cards")
  })

  it("nebeneinander (gleicher Anfang) gilt der angesprungene, sonst der späteste", () => {
    // Vergleichen ab 768 px: Bild und Vergleich in einer Zeile, darunter Verlauf und Zahlen
    const row = [
      box("picture", 56),
      box("comparison", 56),
      box("history", 700),
      box("numbers", 1100),
    ]
    expect(activeSection(row, false, "picture")).toBe("picture")
    expect(activeSection(row, false, "comparison")).toBe("comparison")
    expect(activeSection(row)).toBe("comparison")
    // weiter gescrollt bleibt der angesprungene, solange die Zeile die späteste ist
    const scrolled = row.map((b) => ({ ...b, top: b.top - 300 }))
    expect(activeSection(scrolled, false, "picture")).toBe("picture")
    // ein späterer Abschnitt an der Leiste geht vor, ein Anker eines anderen Abschnitts zählt nicht
    const later = row.map((b) => ({ ...b, top: b.top - 650 }))
    expect(activeSection(later, false, "picture")).toBe("history")
    // die Scheibe: Schüsse rechts beginnen tiefer, sie lösen die Scheibe weiter ab
    expect(activeSection([box("target", 56), box("shots", 90)], false, "target")).toBe("shots")
  })

  it("über den Serien bleibt die Scheibe aktiv; ganz oben die Scheibe, am Ende der letzte", () => {
    expect(activeSection([box("target", -200), box("shots", 600), box("analysis", 1300)])).toBe(
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
