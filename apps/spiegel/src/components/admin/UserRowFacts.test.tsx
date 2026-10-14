import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UserRowFacts } from "./UserRowFacts"

const render = (user: Partial<Parameters<typeof UserRowFacts>[0]["user"]>) =>
  renderToStaticMarkup(
    createElement(UserRowFacts, {
      user: { cards: 0, lastCardAt: null, waiting: 0, quiet: false, ...user },
      timeZone: "Europe/Berlin",
    })
  )

describe("Zahlen eines Kontos (P2e)", () => {
  it("Zahl, Tag der letzten in der Zone, Wartende; Einzahl und Mehrzahl", () => {
    expect(render({ cards: 32, lastCardAt: "2026-10-13T22:30:00.000Z", waiting: 3 })).toContain(
      "32 Scheiben · zuletzt 14.10.2026 · 3 warten in Offen"
    )
    expect(render({ cards: 1, lastCardAt: "2026-10-13T17:00:00.000Z", waiting: 1 })).toContain(
      "1 Scheibe · zuletzt 13.10.2026 · 1 wartet in Offen"
    )
    expect(render({})).toContain("noch keine Scheibe")
  })

  it("der Hinweis nur bei einer stillen Zustimmung, in warning", () => {
    expect(render({})).not.toContain("data-user-quiet")
    expect(render({ quiet: true })).toMatch(
      /<span data-user-quiet="true" class="text-warning">noch keine Scheibe seit der Bestätigung<\/span>/
    )
  })
})
