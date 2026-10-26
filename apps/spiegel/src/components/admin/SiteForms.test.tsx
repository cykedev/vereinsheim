import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/admin/site-actions", () => ({
  pairBridge: async () => ({ success: true }),
  revokeBridgeAction: async () => ({ success: true }),
  removeBridgeAction: async () => ({ success: true }),
  saveSite: async () => ({ success: true }),
}))

const { BridgeItem, bridgeActionOf, PairBridgeForm, SiteForm } = await import("./SiteForms")
const actions = await import("@/lib/admin/site-actions")
const { bridgeRemove, bridgeRevoke } = await import("@/lib/admin/consequences")

describe("Anlage und Brücke (Markup)", () => {
  it("„Entfernen“ nur an einer getrennten Brücke, „Trennen“ nur an einer laufenden", () => {
    const item = (revoked: boolean) =>
      renderToStaticMarkup(
        createElement(BridgeItem, {
          bridge: {
            id: 1,
            name: "Mac (Kopie 9.10.)",
            version: "0.1.0",
            createdAt: "14.10.2026",
            lastSeenAt: null,
            lastHeartbeatAt: null,
            revoked,
            status: null,
            clockOffsetSeconds: null,
            backlog: null,
            heldBack: null,
          },
        })
      )
    expect(item(true)).toContain(">Entfernen<")
    expect(item(true)).not.toContain(">Trennen<")
    expect(item(false)).toContain(">Trennen<")
    expect(item(false)).not.toContain(">Entfernen<")
  })

  it("Uhr am Gerät falsch: als Zustand, ohne die Zeile zur Uhr der Meyton-Anlage (SF-79)", () => {
    const item = (status: "ok" | "clock") =>
      renderToStaticMarkup(
        createElement(BridgeItem, {
          bridge: {
            id: 1,
            name: "Pi",
            version: "0.1.0",
            createdAt: "15.10.2026",
            lastSeenAt: null,
            lastHeartbeatAt: "15.10.2026, 19:00",
            revoked: false,
            status,
            // eine ältere Brücke ohne eigene Prüfung meldete die eigene Verspätung als Abweichung der Anlage
            clockOffsetSeconds: 162000,
            backlog: null,
            heldBack: null,
          },
        })
      )
    expect(item("clock")).toContain(
      "Uhr am Gerät geht falsch (schickt keine Scheiben, bis sie stimmt)"
    )
    expect(item("clock")).not.toContain("Uhr der Meyton-Anlage")
    expect(item("ok")).toContain("Uhr der Meyton-Anlage geht 162000 s vor")
  })

  it("Knopf, Dialog und Action gehören zusammen: getrennt entfernen, laufend trennen", () => {
    const device = "Mac (Kopie 9.10.)"
    expect(bridgeActionOf({ name: device, revoked: true })).toEqual({
      label: "Entfernen",
      decision: bridgeRemove({ device }),
      run: actions.removeBridgeAction,
    })
    expect(bridgeActionOf({ name: device, revoked: false })).toEqual({
      label: "Trennen",
      decision: bridgeRevoke({ device }),
      run: actions.revokeBridgeAction,
    })
  })

  it("Brücke mit „Trennen“, Verbinden und Anlage mit „?“", () => {
    const bridge = renderToStaticMarkup(
      createElement(BridgeItem, {
        bridge: {
          id: 1,
          name: "Pi",
          version: "0.1.0",
          createdAt: "13.10.2026",
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
    expect(bridge).toContain("verbunden am 13.10.2026")
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

  it("mit Scheiben ist die Zeitzone fest und sagt warum", () => {
    const html = renderToStaticMarkup(
      createElement(SiteForm, {
        site: { id: 1, name: "Schützenhaus", timeZone: "Europe/Berlin", hasCards: true },
      })
    )
    expect(html).toMatch(/id="timeZone"[^>]*readOnly=""|readOnly=""[^>]*id="timeZone"/)
    expect(html).toContain("Lässt sich nicht mehr ändern, weil schon Scheiben da sind.")
  })

  it("Anlage und Brücke nennt keine Listen; die haben einen eigenen Bereich", () => {
    const page = readFileSync(join(__dirname, "../../app/(app)/admin/site/page.tsx"), "utf8")
    // nur der Text der Seite, ohne Kommentare
    const text = page.replace(/\/\/.*$/gm, "")
    expect(text).not.toMatch(/Listen|Ranking/)
  })

  it("kein „Epoche“ in Seite und Bausteinen", () => {
    for (const file of [
      join(__dirname, "SiteForms.tsx"),
      join(__dirname, "../../app/(app)/admin/site/page.tsx"),
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(/Epoche/)
  })
})
