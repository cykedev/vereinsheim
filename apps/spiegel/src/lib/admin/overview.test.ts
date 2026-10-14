import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { overviewModel } = await import("./overview")
type Input = Parameters<typeof overviewModel>[0]

const base: Input = {
  site: { name: "Schützenhaus", foreignSource: false },
  bridge: {
    name: "Pi im Schützenhaus",
    lastHeartbeatAt: "14.10.2026, 22:14",
    online: false,
    status: "ok",
    heldBack: null,
  },
  consents: [],
  accounts: { total: 12, deactivated: 1, withSportpass: 9 },
}
const consent = (id: number, status: Input["consents"][number]["status"]) => ({
  id,
  userId: `u${id}`,
  who: `Schütze ${id}`,
  sportpassId: String(1000 + id),
  consentedAt: "14.10.2026, 19:02",
  status,
})

describe("Übersicht des Admins", () => {
  it("ohne Offenes keine Aufgabe; die vier Stationen in ihrer Folge", () => {
    const model = overviewModel(base)
    expect(model.tasks).toEqual([])
    expect(model.stations.map((s) => s.id)).toEqual(["site", "bridge", "consents", "accounts"])
  })

  it("Aufgaben nur für Entscheidungen: offene und zurückgegebene Zustimmungen mit Link aufs Konto", () => {
    const model = overviewModel({
      ...base,
      consents: [
        consent(1, "requested"),
        consent(2, "active"),
        consent(3, "returned"),
        consent(4, "rejected"),
      ],
    })
    expect(model.tasks.map((t) => [t.title, t.href, t.action])).toEqual([
      ["Schütze 1 möchte die eigenen Scheiben automatisch", "/admin/users/u1", "Prüfen"],
      ["Schütze 3: erste Scheibe war „nicht meine“", "/admin/users/u3", "Prüfen"],
    ])
    const consents = model.stations.find((s) => s.id === "consents")!
    expect(consents).toMatchObject({ status: "2 offen", tone: "wait" })
    expect(consents.facts).toEqual(["1 aktiv · 2 warten auf dich · 1 abgelehnt"])
  })

  it("Einrichten als Aufgabe: ohne Anlage, ohne Brücke", () => {
    expect(overviewModel({ ...base, site: null, bridge: null }).tasks.map((t) => t.id)).toEqual([
      "site",
    ])
    expect(overviewModel({ ...base, bridge: null }).tasks.map((t) => t.id)).toEqual(["bridge"])
  })

  it("was die Brücke meldet, ist Information, keine Aufgabe (D0)", () => {
    const model = overviewModel({
      ...base,
      bridge: {
        ...base.bridge!,
        status: "possible-reset",
        heldBack: "2 Scheiben verdeckt zurückgehalten",
      },
    })
    expect(model.tasks).toEqual([])
    const bridge = model.stations.find((s) => s.id === "bridge")!
    expect(bridge).toMatchObject({ status: "aus, normal", tone: "neutral" })
    expect(bridge.facts).toEqual([
      "Pi im Schützenhaus",
      "zuletzt online 14.10.2026, 22:14",
      "meldet: Ablage der Anlage sieht neu aus; Spiegel trennt alte und neue Scheiben selbst",
      "2 Scheiben verdeckt zurückgehalten",
    ])
    expect(
      overviewModel({ ...base, bridge: { ...base.bridge!, online: true } }).stations[1].status
    ).toBe("läuft")
  })

  it("eine unbekannte Ablage ist ein Hinweis an der Anlage, keine Aufgabe (D0)", () => {
    const model = overviewModel({ ...base, site: { name: "Schützenhaus", foreignSource: true } })
    expect(model.tasks).toEqual([])
    expect(model.stations[0].tone).toBe("wait")
    expect(model.stations[0].facts[1]).toContain("nimmt sie nicht an")
  })

  it("eine Brücke ohne jeden Kontakt ist kein „aus, normal“ (Review)", () => {
    const model = overviewModel({ ...base, bridge: { ...base.bridge!, lastHeartbeatAt: null } })
    expect(model.stations[1]).toMatchObject({ status: "noch kein Kontakt", tone: "wait" })
  })

  it("Konten gezählt, deaktivierte nur, wenn es welche gibt", () => {
    expect(overviewModel(base).stations[3].facts).toEqual([
      "12 Konten · 9 mit Sportpass · 1 deaktiviert",
    ])
    expect(
      overviewModel({ ...base, accounts: { total: 1, deactivated: 0, withSportpass: 0 } })
        .stations[3].facts
    ).toEqual(["1 Konto · 0 mit Sportpass"])
  })
})
