import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { NewCardSheet } from "./NewCardSheet"

const OPTIONS = [
  { id: 1, name: "LP 40", family: "Luftpistole" },
  { id: 2, name: "LG 40", family: "Luftgewehr" },
]
const render = (
  preset: { disciplineId: number | null; kind: "training" | "competition" },
  relifts = false
) =>
  renderToStaticMarkup(
    createElement(NewCardSheet, {
      open: true,
      onClose: () => {},
      idLine: "ID ff914420 vom Di 27.10.2026",
      relifts,
      options: OPTIONS,
      preset,
      pending: false,
      onCreate: () => {},
    })
  )

describe("Blatt „Neue Scheibe“ (Markup)", () => {
  it("Vorbelegung markiert, Art gewählt, Knopf frei", () => {
    const html = render({ disciplineId: 2, kind: "competition" })
    expect(html).toContain("data-new-card")
    expect(html).toContain("ID ff914420 vom Di 27.10.2026")
    expect(
      [...html.matchAll(/aria-current="true"[^>]*>\s*<span>([^<]+)</g)].map((m) => m[1])
    ).toEqual(["LG 40"])
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Wettkampf</)
    expect(html).toMatch(
      /<button[^>]*data-new-card-create="true"(?![^>]*disabled)[^>]*>Scheibe anlegen/
    )
    expect(html).not.toContain("Wähle eine Disziplin.")
    expect(html).not.toContain("hattest du gelöscht")
  })

  it("ohne Vorbelegung aktiv, ohne Hinweis vor dem Tippen; nach aufgehobener Sperre der Satz dazu", () => {
    const html = render({ disciplineId: null, kind: "training" }, true)
    expect(html).not.toContain('aria-current="true"')
    // aktiv: ohne Wahl sagt der Knopf beim Tippen „Wähle eine Disziplin.“ (Skriptprüfung)
    expect(html).toMatch(
      /<button[^>]*data-new-card-create="true"(?![^>]*disabled)[^>]*>Scheibe anlegen/
    )
    expect(html).not.toContain("Wähle eine Disziplin.")
    expect(html).toContain("Diese Scheibe hattest du gelöscht. Spiegel holt sie wieder.")
  })
})
