import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}))
vi.mock("@/lib/entered/actions", () => ({ saveEnteredCard: async () => ({ success: true }) }))

const { EnteredCardForm } = await import("./EnteredCardForm")
const { emptyForm } = await import("@/lib/entered/form")

const LG40 = { id: 1, name: "LG 40", plannedShots: 40, seriesShots: 10, officialScoring: null }
const render = (over: Partial<Parameters<typeof EnteredCardForm>[0]> = {}) => {
  const discipline = over.discipline ?? LG40
  return renderToStaticMarkup(
    createElement(EnteredCardForm, {
      mode: "new",
      discipline,
      kind: "training",
      initial: emptyForm(discipline, "2026-10-28"),
      places: ["Schützenhaus Nord"],
      today: "2026-10-28",
      back: "/scan",
      choices: { options: [] },
      ...over,
    })
  )
}

describe("Ergebnis eintragen (Markup)", () => {
  it("Kopf, Wann und wo, Werte, Serien nach der Disziplin, Trefferlage, Speichern", () => {
    const html = render()
    expect(html).toContain(">Ergebnis eintragen<")
    expect(html).toContain("LG 40 · Training")
    expect(html).toContain(">Ändern<")
    expect(html).toMatch(/id="entered-day"[^>]*max="2026-10-28"/)
    expect(html).toContain("Uhrzeit (wenn bekannt)")
    expect(html).toContain('placeholder="etwa Schützenhaus Musterdorf"')
    expect(html).toContain('<option value="Schützenhaus Nord">')
    expect(html).toContain('aria-label="Werte in"')
    expect(html).toContain(">nur Gesamtergebnis<")
    expect(html.match(/data-entered-row=/g)).toHaveLength(4)
    expect(html).toContain("Schüsse einzeln")
    expect(html).toContain("Serie hinzufügen")
    expect(html).toContain("Trefferlage (wenn bekannt)")
    expect(html).toContain("Die Mitte deiner Schüsse, wie sie die Anlage anzeigt.")
    for (const word of ["waagrecht", "senkrecht", "links", "rechts", "hoch", "tief"])
      expect(html).toContain(`>${word}<`)
    expect(html).toContain(">Speichern<")
  })

  it("aufgeklappt: die Summe aus den Schüssen, gesperrt, zehn Felder", () => {
    const initial = emptyForm(LG40, "2026-10-28")
    initial.series[1] = { sum: "", open: true, shots: ["10,4", "9,8", ...Array(8).fill("")] }
    const html = render({ initial })
    expect(html).toContain("aus den Schüssen")
    expect(html).toMatch(
      /id="series-1-sum"[^>]*value="20,2"[^>]*readOnly|readonly[^>]*value="20,2"/i
    )
    expect(html.match(/aria-label="Serie 2, Schuss \d+"/g)).toHaveLength(10)
    expect(html).toContain('aria-expanded="true"')
  })

  it("ohne Serienlänge nur das Gesamtergebnis mit Schusszahl", () => {
    const discipline = { ...LG40, seriesShots: null }
    const html = render({ discipline })
    expect(html).not.toContain("nur Gesamtergebnis")
    expect(html).not.toContain("data-entered-row")
    expect(html).toContain(">Schusszahl<")
    expect(html).toMatch(/id="entered-total-shots"[^>]*placeholder="40"/)
  })

  it("ändern: anderer Titel, kein Wechsel der Disziplin", () => {
    const html = render({ mode: "edit", cardId: "c1", choices: undefined, back: "/cards/c1" })
    expect(html).toContain(">Eintrag ändern<")
    expect(html).not.toContain(">Ändern<")
  })
})
