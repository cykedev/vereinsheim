import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PeriodPage } from "./PeriodPage"
import { SectionNav } from "./SectionNav"
import { parsePeriodHash, PERIOD_SECTIONS } from "./sections"
import { activeSection } from "./useActiveSection"

const page = (empty?: string) =>
  renderToStaticMarkup(
    h(PeriodPage, {
      header: h("p", null, "KOPF"),
      nav: h("nav", null, "LEISTE"),
      chart: h("p", null, "VERLAUF"),
      under: h("p", null, "UMFANG"),
      result: h("p", null, "ERGEBNIS"),
      aside: h("p", null, "ABLESUNG"),
      beside: [{ id: "scheiben", node: h("p", null, "SCHEIBEN") }],
      below: [
        { id: "zahlen", node: h("p", null, "ZAHLEN") },
        { id: "analyse", node: h("p", null, "ANALYSE") },
      ],
      empty: empty ? h("p", null, empty) : undefined,
    })
  )

describe("Rahmen der Seite eines Zeitraums (D1)", () => {
  const html = page()

  it("auf dem Telefon eine Spalte in der Reihenfolge der Seite", () => {
    const order = [
      "KOPF",
      "LEISTE",
      "VERLAUF",
      "UMFANG",
      "ERGEBNIS",
      "ABLESUNG",
      "SCHEIBEN",
      "ZAHLEN",
      "ANALYSE",
    ]
    const at = order.map((word) => html.indexOf(word))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it("der Verlauf klebt ab 768 px, die Box nur ab 768 px, die Liste füllt die Höhe", () => {
    expect(html).toMatch(/<div id="verlauf" class="[^"]*scroll-mt-14/)
    expect(html).toMatch(/data-section="verlauf" class="[^"]*md:sticky md:top-14/)
    expect(html).toMatch(/data-result-box="true" class="[^"]*max-md:hidden/)
    expect(html).toMatch(/id="scheiben" data-section="scheiben" class="[^"]*md:flex-1/)
    expect(html).toMatch(/id="zahlen" data-section="zahlen" class="min-w-0 scroll-mt-14"/)
    // der letzte Abschnitt mindestens fensterhoch: auch ein kurzer Abschnitt davor erreicht die Leiste
    expect(html).toMatch(
      /id="analyse" data-section="analyse" class="[^"]*min-h-\[calc\(100svh-3\.5rem\)\]/
    )
  })

  it("ohne Scheiben nur Kopf und Hinweis", () => {
    const empty = page("KEINE")
    expect(empty).toContain("KOPF")
    expect(empty).toContain("KEINE")
    for (const word of ["LEISTE", "VERLAUF", "ERGEBNIS", "SCHEIBEN", "ZAHLEN"]) {
      expect(empty).not.toContain(word)
    }
  })
})

describe("Abschnitte der Seite eines Zeitraums (D2)", () => {
  it("Sprungleiste mit vier Ankern", () => {
    const nav = renderToStaticMarkup(
      h(SectionNav, { active: "scheiben", sections: PERIOD_SECTIONS })
    )
    expect([...nav.matchAll(/<a href="#([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "verlauf",
      "scheiben",
      "zahlen",
      "analyse",
    ])
    expect(nav).toMatch(/<a href="#scheiben" aria-current="location"/)
  })

  it("Anker hin und zurück, Unbekanntes null", () => {
    for (const { id } of PERIOD_SECTIONS) expect(parsePeriodHash(`#${id}`)).toBe(id)
    expect(parsePeriodHash("#scheibe")).toBeNull()
    expect(parsePeriodHash("")).toBeNull()
  })

  it("aktiver Abschnitt mit den Ids der Seite", () => {
    const boxes = [
      { id: "verlauf" as const, top: -400 },
      { id: "scheiben" as const, top: 60 },
      { id: "zahlen" as const, top: 900 },
    ]
    expect(activeSection(boxes)).toBe("scheiben")
    expect(activeSection(boxes, true)).toBe("zahlen")
  })
})
