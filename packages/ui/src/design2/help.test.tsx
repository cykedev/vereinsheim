import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HELP_FIELDS, HelpBody, HelpButton, type HelpText } from "./help"
import { HelpSheet } from "./help-sheet"

const full: HelpText = {
  title: "Teiler",
  short: "Abstand des Treffers zur Mitte",
  what: "Der Abstand der Mitte des Treffers zur Mitte der Scheibe.",
  read: "Kleiner ist besser.",
  act: "Auf den Ablauf achten.",
  caution: "Ein einzelner Schuss sagt wenig.",
  minimum: "Ab fünf Schuss.",
  formula: "teiler = 100 · r / mm",
}

describe("HelpBody", () => {
  it("jedes vorhandene Feld in der Reihenfolge des Leitfadens, die Formel zugeklappt danach", () => {
    const html = renderToStaticMarkup(createElement(HelpBody, { topic: full }))
    let at = -1
    for (const [field, label] of HELP_FIELDS) {
      const next = html.indexOf(`<b>${label}:</b> ${full[field]}`)
      expect(next, field).toBeGreaterThan(at)
      at = next
    }
    expect(html.indexOf("<details>")).toBeGreaterThan(at)
    expect(html).toContain("Formel für Profis")
    expect(html).toContain(full.formula)
  })

  it("fehlende Felder fehlen, ohne Formel kein Aufklappen", () => {
    const html = renderToStaticMarkup(
      createElement(HelpBody, { topic: { title: "Teiler", what: "Abstand zur Mitte." } })
    )
    expect(html).toContain("<b>Was:</b> Abstand zur Mitte.")
    expect(html).not.toContain("So liest du es")
    expect(html).not.toContain("<details>")
  })
})

describe("HelpButton", () => {
  it("nennt, wofür die Erklärung ist, und trägt die Id", () => {
    const html = renderToStaticMarkup(
      createElement(HelpButton, { label: "Teiler", helpId: "teiler", onClick: () => {} })
    )
    expect(html).toMatch(/^<button type="button" aria-label="Erklärung: Teiler" data-help="teiler"/)
  })
})

describe("HelpSheet", () => {
  it("offen mit Titel und Erklärung, zu ohne Inhalt", () => {
    const open = renderToStaticMarkup(createElement(HelpSheet, { entry: full, onClose: () => {} }))
    expect(open).toContain("Teiler")
    expect(open).toContain("<b>Was:</b>")
    const closed = renderToStaticMarkup(
      createElement(HelpSheet, { entry: null, onClose: () => {} })
    )
    expect(closed).not.toContain("<b>Was:</b>")
  })
})
