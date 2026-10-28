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
vi.mock("@/lib/card-place-actions", () => ({ setCardPlace: async () => ({ success: true }) }))
vi.mock("@/lib/trash-actions", () => ({
  deleteCard: async () => ({ success: true }),
  restoreCard: async () => ({ success: true }),
}))

const { CardActions } = await import("./CardActions")

type Props = Parameters<typeof CardActions>[0]
const render = (fetch: Props["fetch"], entry: Props["entry"] = null) =>
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
      entry,
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
      printouts: [
        {
          id: "cp1",
          printedAtMs: Date.UTC(2026, 9, 13, 17, 52),
          unreadable: false,
          mismatch: false,
        },
      ],
      request: {
        id: 7,
        status: "open",
        filled: false,
        printoutValues: false,
        hex: "ff914420",
        day: "2026-10-13",
      },
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
    expect(rowText(html, "data-card-fetch")).toContain(
      "Spiegel holt die Werte, sobald die Anlage läuft."
    )
  })

  it("wartet mit Werten vom Ausdruck: die Anlage bringt Messwerte und Zeiten", () => {
    const html = render({
      hex: "ff914420",
      printouts: [],
      request: {
        id: 7,
        status: "open",
        filled: false,
        printoutValues: true,
        hex: "ff914420",
        day: "2026-10-13",
      },
    })
    expect(rowText(html, "data-card-fetch")).toContain(
      "Die Werte sind vom Ausdruck. Spiegel holt die Messwerte und Zeiten, sobald die Anlage läuft."
    )
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
        printoutValues: false,
        hex: "ff914420",
        day: "2026-10-13",
      },
    })
    expect(html).toContain('data-fetch-status="printMismatch"')
    const row = rowText(html, "data-card-fetch")
    expect(row).toContain("passt nicht zum Ausdruck")
    expect(row).toContain("Die Scheibe der Anlage begann nach dem Druck oder hat andere Werte.")
    expect(row).toContain("Entfernen")
    expect(row).not.toContain("Nicht mehr holen")
  })

  it("offen und gefüllt: „geholt, wird noch ergänzt“ ohne Knopf", () => {
    const html = render({
      hex: "ff914420",
      printouts: [],
      request: {
        id: 7,
        status: "open",
        filled: true,
        printoutValues: false,
        hex: "ff914420",
        day: "2026-10-13",
      },
    })
    const row = rowText(html, "data-card-fetch")
    expect(row).toBe("Von der Anlage geholt, wird noch ergänzt")
  })
})

describe("Eintrag und Ort je Herkunft", () => {
  it("eingetragen: „Eintrag“ zuerst, mit „Ändern“ zum Formular; ohne Ort-Zeile", () => {
    const html = render(null, { kind: "entered", from: "manual", editable: true })
    expect(html.indexOf("data-card-entry")).toBeLessThan(html.indexOf("data-card-discipline"))
    expect(rowText(html, 'data-card-entry="manual"')).toContain("Eintrag Von Hand eingetragen")
    expect(html).toContain('href="/cards/c1/edit"')
    expect(html).not.toContain("data-card-place")
  })

  it("aus Treffsicher, nicht ganz zu zeigen: ohne „Ändern“", () => {
    const html = render(null, { kind: "entered", from: "treffsicher", editable: false })
    expect(rowText(html, 'data-card-entry="treffsicher"')).toContain("Aus Treffsicher übernommen")
    expect(html).not.toContain("/edit")
  })

  it("vom Ausdruck: Ort mit „Ändern“, ohne Ort der Satz", () => {
    const html = render(null, { kind: "place", place: null, places: [] })
    expect(rowText(html, "data-card-place")).toContain("Ort Kein Ort angegeben")
    expect(html).toContain('aria-label="Ort ändern"')
    expect(render(null, { kind: "place", place: "Halle", places: [] })).toMatch(
      /data-place-name[^>]*>Halle</
    )
  })

  it("von der Anlage: weder Eintrag noch Ort", () => {
    const html = render(null, null)
    expect(html).not.toContain("data-card-entry")
    expect(html).not.toContain("data-card-place")
  })
})
