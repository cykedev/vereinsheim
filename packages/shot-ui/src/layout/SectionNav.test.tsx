import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SectionNav } from "./SectionNav"
import { pickActive } from "./useActiveSection"

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
  it("von den Abschnitten in der Mitte gewinnt der späteste (die feste Scheibe schneidet immer)", () => {
    expect(pickActive(new Set(["scheibe", "zahlen"]), null)).toBe("zahlen")
    expect(pickActive(new Set(["scheibe"]), "analyse")).toBe("scheibe")
  })

  it("schneidet keiner die Mitte, bleibt der vorige", () => {
    expect(pickActive(new Set(), "zahlen")).toBe("zahlen")
    expect(pickActive(new Set(), null)).toBeNull()
  })
})
