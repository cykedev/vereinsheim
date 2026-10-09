import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DEFAULT_PROGRESS } from "../nav/routes"
import { FormLine } from "./FormLine"
import type { StartForm } from "./model"
import { OpenBox } from "./OpenBox"

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("Offen auf Start (Plan N5, D1)", () => {
  const items = [
    {
      id: "confirm",
      title: "Erste Scheibe bestätigen",
      detail: "Sa 26.09., Luftgewehr",
      route: { page: "open" as const },
    },
    {
      id: "scan",
      title: "QR-Scan wartet",
      detail: "Ausdruck vom 25.09.",
      route: { page: "scan" as const },
    },
  ]

  it("Titel mit Zahl, je Eintrag ein Link", () => {
    const html = renderToStaticMarkup(h(OpenBox, { items }))
    expect(html).toMatch(/<h2[^>]*>Offen <span[^>]*>2<\/span><\/h2>/)
    expect(
      [...html.matchAll(/<a href="([^"]+)"[^>]*data-open-item="([^"]+)"/g)].map((m) => [m[1], m[2]])
    ).toEqual([
      ["/open", "confirm"],
      ["/scan", "scan"],
    ])
    expect(text(html)).toContain("Erste Scheibe bestätigen Sa 26.09., Luftgewehr")
  })

  it("ohne Offenes nichts", () => {
    expect(renderToStaticMarkup(h(OpenBox, { items: [] }))).toBe("")
  })
})

describe("Form, letzte 90 Tage (Plan N5, D7)", () => {
  const form: StartForm = {
    family: "lg-freihand",
    mean: 10.27,
    cards: 37,
    comparison: {
      a: { n: 30, mean: 10.24 },
      b: { n: 37, mean: 10.27 },
      delta: 0.03,
      test: { p: 0.4, exact: false },
      verdict: "unclear",
      meaningful: null,
    },
    compareLabel: "Zeitraum davor",
    route: {
      page: "progress",
      query: { ...DEFAULT_PROGRESS, family: "lg-freihand", compare: { type: "previous" } },
      section: null,
    },
  }

  it("eine Zeile mit Ø, Abstand und Urteil, als Link in den Fortschritt mit dem Vergleich", () => {
    const html = renderToStaticMarkup(h(FormLine, { form, familyLabel: "Luftgewehr" }))
    expect(html).toMatch(
      /^<a href="\/progress\?compare=previous&amp;family=lg-freihand" data-form-line="true"/
    )
    expect(text(html)).toBe(
      "Form, letzte 90 Tage · Luftgewehr: Ø 10,27 je Schuss · +0,03 gegen Zeitraum davor · nicht nachweisbar ›"
    )
  })

  it("ohne Vergleich „zu wenige Scheiben“, ohne Wert nichts", () => {
    expect(
      text(
        renderToStaticMarkup(
          h(FormLine, { form: { ...form, comparison: null }, familyLabel: "Luftgewehr" })
        )
      )
    ).toBe(
      "Form, letzte 90 Tage · Luftgewehr: Ø 10,27 je Schuss · gegen Zeitraum davor: zu wenige Scheiben ›"
    )
    expect(
      renderToStaticMarkup(
        h(FormLine, { form: { ...form, mean: null }, familyLabel: "Luftgewehr" })
      )
    ).toBe("")
  })
})
