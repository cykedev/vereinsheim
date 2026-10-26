import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, replace: () => {} }) }))
vi.mock("@/lib/card-discipline-actions", () => ({
  setCardDiscipline: async () => ({ success: true }),
}))
vi.mock("@/lib/share-actions", () => ({
  shareCard: async () => ({ success: true }),
  stopSharingCard: async () => ({ success: true }),
}))
vi.mock("@/lib/trash-actions", () => ({
  deleteCard: async () => ({ success: true }),
  restoreCard: async () => ({ success: true }),
}))

const { CardActions } = await import("./CardActions")

describe("Kasten „Diese Scheibe“", () => {
  it("ein Kasten mit Überschrift, darin Disziplin, Teilen, Löschen in dieser Reihenfolge", () => {
    const html = renderToStaticMarkup(
      createElement(CardActions, {
        cardId: "c1",
        when: "Di 13.10.2026 · 19:12",
        timeZone: "Europe/Berlin",
        discipline: {
          current: "LP 40",
          family: "Luftpistole",
          scoring: "rings",
          stand: null,
          options: [],
        },
        share: null,
        onShareChange: () => {},
        back: "/cards",
      })
    )
    expect(html).toMatch(
      /^<section data-card-actions="true" aria-labelledby="card-actions-title" class="[^"]*rounded-2xl[^"]*bg-card/
    )
    expect(html).toMatch(/<h2 id="card-actions-title"[^>]*>Diese Scheibe<\/h2>/)
    const order = ["data-card-discipline", "data-share-card", "data-delete-card"].map((a) =>
      html.indexOf(a)
    )
    expect(order.every((i) => i > 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toContain("Danach liegt die Scheibe 30 Tage im Papierkorb im Profil.")
    expect(html).toMatch(/<button[^>]*aria-label="Scheibe löschen"[^>]*>[\s\S]*?Löschen<\/button>/)
  })
})
