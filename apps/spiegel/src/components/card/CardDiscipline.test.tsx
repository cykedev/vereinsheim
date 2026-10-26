import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { DisciplineOption } from "@/lib/db/cards"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/card-discipline-actions", () => ({
  setCardDiscipline: async () => ({ success: true }),
}))

const { CardDiscipline } = await import("./CardDiscipline")

const options: DisciplineOption[] = [
  { id: 1, name: "LP 40", family: "Luftpistole", stand: true, current: true, scoring: "rings" },
  {
    id: 2,
    name: "LP Auflage 30",
    family: "Luftpistole Auflage",
    stand: false,
    current: false,
    scoring: "decimal",
  },
]
const render = (props: Partial<Parameters<typeof CardDiscipline>[0]>) =>
  renderToStaticMarkup(
    createElement(CardDiscipline, {
      cardId: "c1",
      when: "Di 13.10.2026 · 19:12",
      current: "LP 40",
      family: "Luftpistole",
      scoring: "rings",
      stand: null,
      options,
      ...props,
    })
  )

describe("Zeile Disziplin", () => {
  it("der Name und „Ändern“, wenn es eine andere gibt; ohne eigene Wahl keine Zeile zum Stand", () => {
    const html = render({})
    expect(html).toMatch(/^<div data-card-discipline="true"/)
    expect(html).toMatch(/<h3[^>]*>Disziplin<\/h3>/)
    expect(html).toMatch(/data-discipline-name[^>]*>LP 40</)
    // kurz sichtbar, der volle Name für Screenreader und die Skriptprüfung
    expect(html).toMatch(/<button[^>]*aria-label="Disziplin ändern"[^>]*>[\s\S]*?Ändern<\/button>/)
    expect(html).not.toContain("data-stand-discipline")
  })

  it("nach einer eigenen Wahl leise die vom Stand", () => {
    const html = render({
      current: "LP Auflage 30",
      family: "Luftpistole Auflage",
      stand: "LP 40",
      options: options.map((o) => ({ ...o, current: !o.current })),
    })
    expect(html).toMatch(/data-discipline-name[^>]*>LP Auflage 30</)
    expect(html).toContain("Am Stand gewählt: LP 40")
  })

  it("ohne andere Möglichkeit nur der Name", () => {
    for (const only of [[], [options[0]]]) {
      const html = render({ options: only })
      expect(html).toContain("data-discipline-name")
      expect(html).not.toContain('aria-label="Disziplin ändern"')
    }
  })
})
