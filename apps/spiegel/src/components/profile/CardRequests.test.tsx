import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { OwnRequest } from "@/lib/card-requests/queries"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/card-requests/actions", () => ({
  requestCardAction: async () => ({ success: true }),
  withdrawCardRequest: async () => ({ success: true }),
}))

const { CardRequests, REQUEST_STATUS_TEXT } = await import("./CardRequests")

const request = (over: Partial<OwnRequest>): OwnRequest => ({
  id: 1,
  hex: "ff914420",
  day: "2026-10-21",
  status: "open",
  cardId: null,
  ...over,
})
const render = (requests: OwnRequest[]) =>
  renderToStaticMarkup(
    createElement(CardRequests, { requests, today: "2026-10-24", timeZone: "Europe/Berlin" })
  )

describe("Abschnitt Scheibe per ID holen", () => {
  it("Formular mit ID und Tag (heute vorgegeben, nicht danach), ohne Aufträge keine Liste", () => {
    const html = render([])
    expect(html).toContain("Scheibe per ID holen")
    expect(html).toMatch(/id="card-request-day"[^>]*max="2026-10-24"/)
    expect(html).toMatch(/id="card-request-day"[^>]*value="2026-10-24"/)
    expect(html).toContain("Scheibe holen</button>")
    expect(html).not.toContain("data-card-request-list")
  })

  it("je Auftrag ID, Tag und Zustand; geholt mit Link, wartend mit Zurückziehen", () => {
    const html = render([
      request({ id: 1 }),
      request({ id: 2, status: "done", cardId: "c1" }),
      request({ id: 3, status: "mismatch" }),
    ])
    expect(html).toContain("Mi 21.10.2026 · wartet auf die Anlage")
    expect(html).toContain("Mi 21.10.2026 · geholt")
    expect(html).toContain("Mi 21.10.2026 · an diesem Tag nicht gefunden")
    expect(html).toContain('href="/cards/c1"')
    expect(html.match(/Zurückziehen<\/button>/g)).toHaveLength(1)
  })

  it("jeder Zustand hat Worte, ohne Semikolon", () => {
    for (const text of Object.values(REQUEST_STATUS_TEXT)) {
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toContain(";")
    }
  })
})
