import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/admin/site-actions", () => ({
  pairBridge: async () => ({ success: true }),
  revokeBridgeAction: async () => ({ success: true }),
  saveSite: async () => ({ success: true }),
  setRankingKind: async () => ({ success: true }),
}))

const { BridgeItem, PairBridgeForm, RankingItem, SiteForm } = await import("./SiteForms")

describe("Anlage und Brücke (Markup)", () => {
  it("Rangliste: „Nicht festgelegt“, Training, Wettkampf; keine sofortige Speicherung im Markup", () => {
    const html = renderToStaticMarkup(
      createElement(RankingItem, {
        ranking: { id: 1, name: "RWK_LP", kind: null, cards: 23 },
      })
    )
    expect(html).toContain(">Nicht festgelegt<")
    expect(html).toContain("23 Scheiben")
  })

  it("Brücke mit „Trennen“, Verbinden und Anlage mit „?“", () => {
    const bridge = renderToStaticMarkup(
      createElement(BridgeItem, {
        bridge: {
          id: 1,
          name: "Pi",
          version: "0.1.0",
          createdAt: "13.10.2026, 18:00",
          lastSeenAt: null,
          lastHeartbeatAt: null,
          revoked: false,
          status: null,
          clockOffsetSeconds: null,
          backlog: null,
          heldBack: null,
        },
      })
    )
    expect(bridge).toContain(">Trennen<")
    const pair = renderToStaticMarkup(createElement(PairBridgeForm))
    expect(pair).toContain("Behandle ihn wie ein Passwort.")
    expect(pair).toContain("Brücke verbinden")
    expect(pair).toContain('data-help="admin-pairingCode"')
    const site = renderToStaticMarkup(
      createElement(SiteForm, {
        site: { id: 1, name: "Schützenhaus", timeZone: "Europe/Berlin", hasCards: false },
      })
    )
    expect(site).toContain('data-help="admin-site"')
    expect(site).toContain('data-help="admin-timeZone"')
  })

  it("mit Scheiben ist die Zeitzone fest und sagt warum (Review)", () => {
    const html = renderToStaticMarkup(
      createElement(SiteForm, {
        site: { id: 1, name: "Schützenhaus", timeZone: "Europe/Berlin", hasCards: true },
      })
    )
    expect(html).toMatch(/id="timeZone"[^>]*readOnly=""|readOnly=""[^>]*id="timeZone"/)
    expect(html).toContain("Lässt sich nicht mehr ändern, weil schon Scheiben da sind.")
  })

  it("kein „Epoche“ mehr in Seite und Bausteinen (D0)", () => {
    for (const file of [
      join(__dirname, "SiteForms.tsx"),
      join(__dirname, "../../app/(app)/admin/site/page.tsx"),
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(/Epoche/)
  })
})
