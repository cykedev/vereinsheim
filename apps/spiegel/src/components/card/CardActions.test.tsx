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
vi.mock("@/lib/fetch-card/actions", () => ({ stopCardFetch: async () => ({ success: true }) }))
vi.mock("@/lib/trash-actions", () => ({
  deleteCard: async () => ({ success: true }),
  restoreCard: async () => ({ success: true }),
}))

const { CardActions } = await import("./CardActions")

type Props = Parameters<typeof CardActions>[0]
const render = (fetch: Props["fetch"]) =>
  renderToStaticMarkup(
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
      fetch,
      share: null,
      onShareChange: () => {},
      back: "/cards",
    })
  )
/** der Text einer Zeile ohne Markup */
const rowText = (html: string, attribute: string) =>
  (html.match(new RegExp(`<div ${attribute}[\\s\\S]*?(?=<div data-card-|$)`))?.[0] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

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
        fetch: null,
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

  it("Ausdruck und Holen vor Disziplin, Teilen, Löschen", () => {
    const html = render({
      hex: "ff914420",
      printouts: [{ id: "cp1", printedAtMs: Date.UTC(2026, 9, 13, 17, 52) }],
      request: { id: 7, status: "open", filled: false, hex: "ff914420", day: "2026-10-13" },
    })
    const order = [
      "data-card-printout",
      "data-card-fetch",
      "data-card-discipline",
      "data-share-card",
      "data-delete-card",
    ].map((a) => html.indexOf(a))
    expect(order.every((i) => i > 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(rowText(html, "data-card-fetch")).toContain("wartet auf die Anlage")
    expect(rowText(html, "data-card-fetch")).toContain("Nicht mehr holen")
  })

  it("ohne ID und ohne Ausdruck keine Zeile „Ausdruck“, ohne Auftrag keine „Von der Anlage“", () => {
    const html = render({ hex: null, printouts: [], request: null })
    expect(html).not.toContain("data-card-printout")
    expect(html).not.toContain("data-card-fetch")
  })

  it("passt nicht zum Ausdruck: Zustand, Satz und „Entfernen“", () => {
    const html = render({
      hex: "ff914420",
      printouts: [],
      request: {
        id: 7,
        status: "printMismatch",
        filled: false,
        hex: "ff914420",
        day: "2026-10-13",
      },
    })
    expect(html).toContain('data-fetch-status="printMismatch"')
    const row = rowText(html, "data-card-fetch")
    expect(row).toContain("passt nicht zum Ausdruck")
    expect(row).toContain("Die Scheibe der Anlage begann erst nach dem Druck.")
    expect(row).toContain("Entfernen")
    expect(row).not.toContain("Nicht mehr holen")
  })

  it("offen und gefüllt: „geholt, wird noch ergänzt“ ohne Knopf", () => {
    const html = render({
      hex: "ff914420",
      printouts: [],
      request: { id: 7, status: "open", filled: true, hex: "ff914420", day: "2026-10-13" },
    })
    const row = rowText(html, "data-card-fetch")
    expect(row).toBe("Von der Anlage geholt, wird noch ergänzt")
  })
})
