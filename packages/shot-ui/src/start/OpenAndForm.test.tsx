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

  const line = (f: StartForm) =>
    text(renderToStaticMarkup(h(FormLine, { form: f, familyLabel: "Luftgewehr" })))

  it("zwei Zeilen, Titel und ein Satz mit Urteil, als Link in den Fortschritt mit dem Vergleich (U5, D4)", () => {
    const html = renderToStaticMarkup(h(FormLine, { form, familyLabel: "Luftgewehr" }))
    expect(html).toMatch(
      /^<a href="\/progress\?compare=previous&amp;family=lg-freihand" data-form-line="true"/
    )
    expect(html).toMatch(/<span[^>]*data-form-title[^>]*>Form der letzten 90 Tage<\/span>/)
    expect(line(form)).toBe(
      "Form der letzten 90 Tage Luftgewehr: Ø 10,27 je Schuss, kein klarer Unterschied zu den 90 Tagen davor (+0,03). ›"
    )
  })

  it("mit Urteil: „deutlich besser als in den 90 Tagen davor“", () => {
    const better: StartForm = {
      ...form,
      comparison: { ...form.comparison!, delta: 0.15, verdict: "higher", meaningful: true },
    }
    expect(line(better)).toBe(
      "Form der letzten 90 Tage Luftgewehr: Ø 10,27 je Schuss, deutlich besser als in den 90 Tagen davor (+0,15). ›"
    )
  })

  it("ohne Vergleich „zu wenige Scheiben“, ohne Wert nichts", () => {
    expect(line({ ...form, comparison: null })).toBe(
      "Form der letzten 90 Tage Luftgewehr: Ø 10,27 je Schuss; für einen Vergleich mit den 90 Tagen davor zu wenige Scheiben. ›"
    )
    expect(
      renderToStaticMarkup(
        h(FormLine, { form: { ...form, mean: null }, familyLabel: "Luftgewehr" })
      )
    ).toBe("")
  })
})
