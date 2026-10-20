import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

import type { SerializableDiscipline } from "@/lib/disciplines/types"

import { DisciplineForm } from "./DisciplineForm"

const discipline = {
  id: "d1",
  name: "Luftpistole",
  scoringType: "WHOLE",
  teilerFaktor: 0.3333333,
  isSystem: false,
  isArchived: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
} as SerializableDiscipline

const render = (factorLock?: "system" | "used" | null) =>
  renderToStaticMarkup(
    createElement(DisciplineForm, {
      discipline,
      action: async () => ({ success: true as const }),
      factorLock,
    })
  )

/** React schreibt das Attribut beim Rendern auf dem Server als `readOnly=""` */
const READ_ONLY = / readonly=""/i

/** das Eingabefeld des Faktors */
const factorInput = (html: string) => html.match(/<input[^>]*id="teilerFaktor"[^>]*>/)?.[0] ?? ""

describe("DisciplineForm: Faktor", () => {
  it("ungenutzt: das Feld ist änderbar und ohne Hinweis auf eine Sperre", () => {
    const html = render(null)
    expect(factorInput(html)).not.toMatch(READ_ONLY)
    expect(html).not.toContain("Gesperrt")
  })

  it("genutzt: das Feld bleibt im Formular, ist aber nur lesbar, mit Grund", () => {
    const html = render("used")
    const input = factorInput(html)
    expect(input).toContain('name="teilerFaktor"')
    expect(input).toMatch(READ_ONLY)
    expect(input).not.toMatch(/ disabled=""/)
    expect(html).toContain("Gesperrt, weil die Disziplin schon in einem Wettbewerb verwendet wird.")
  })

  it("Standarddisziplin: nur lesbar, Ringwerk legt den Faktor fest", () => {
    const html = render("system")
    expect(factorInput(html)).toMatch(READ_ONLY)
    expect(html).toContain("Standarddisziplin: Ringwerk legt den Faktor fest.")
  })
})
