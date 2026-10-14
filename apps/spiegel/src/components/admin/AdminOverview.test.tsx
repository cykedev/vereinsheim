import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { overviewModel } = await import("@/lib/admin/overview")
const { AdminOverview } = await import("./AdminOverview")

const model = (consents: Parameters<typeof overviewModel>[0]["consents"]) =>
  overviewModel({
    site: { name: "Schützenhaus", foreignSource: false },
    bridge: { name: "Pi", lastHeartbeatAt: null, online: false, status: null, heldBack: null },
    consents,
    accounts: { total: 2, deactivated: 0, withSportpass: 1 },
    notMine: 0,
  })

describe("Übersicht des Admins (Markup)", () => {
  it("eine offene Zustimmung als Aufgabe mit Link, darunter vier Stationen mit „?“", () => {
    const html = renderToStaticMarkup(
      createElement(AdminOverview, {
        model: model([
          {
            id: 1,
            userId: "u1",
            who: "Max Muster",
            sportpassId: "12345678",
            consentedAt: "14.10.2026, 19:02",
            status: "requested",
          },
        ]),
      })
    )
    expect(html).toContain("Wartet auf dich (1)")
    expect(html).toContain("Max Muster möchte die eigenen Scheiben automatisch")
    expect(html).toContain('href="/admin/users/u1"')
    expect(html.match(/data-admin-station=/g)).toHaveLength(4)
    expect(html.match(/data-help="admin-/g)).toHaveLength(4)
    expect(html).not.toContain("Epoche")
  })

  it("ohne Aufgabe der Satz", () => {
    const html = renderToStaticMarkup(createElement(AdminOverview, { model: model([]) }))
    expect(html).toContain("Wartet auf dich (0)")
    expect(html).toContain("Nichts wartet auf dich.")
  })
})
