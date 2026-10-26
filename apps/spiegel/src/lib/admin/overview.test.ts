import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { accountsLoadingHistory, overviewModel } = await import("./overview")
const { OLD_WORDS } = await import("./consequences")
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
  notMine: 0,
  historyPending: 0,
  usage: { cards: 124, recentCards: 9, recentAccounts: 4 },
  disciplines: { waiting: 0, suggested: 0 },
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
      [
        "Schütze 1 möchte die eigenen Scheiben automatisch bekommen",
        "/admin/users/u1",
        "Nummer prüfen",
      ],
      [
        "Schütze 3 hat eine Scheibe als „nicht meine“ zurückgewiesen",
        "/admin/users/u3",
        "Nummer prüfen",
      ],
    ])
    expect(model.tasks.map((t) => t.detail)).toEqual([
      "Sportpassnummer 1001, eingetragen am 14.10.2026, 19:02",
      "Prüf die Sportpassnummer 1003 noch einmal.",
    ])
    const consents = model.stations.find((s) => s.id === "consents")!
    expect(consents).toMatchObject({ status: "2 warten auf dich", tone: "wait" })
    expect(consents.facts).toEqual(["1 aktiv · 2 warten auf dich · 1 abgelehnt"])
  })

  it("Einrichten als Aufgabe: ohne Anlage, ohne Brücke", () => {
    expect(overviewModel({ ...base, site: null, bridge: null }).tasks.map((t) => t.id)).toEqual([
      "site",
    ])
    expect(overviewModel({ ...base, bridge: null }).tasks.map((t) => t.id)).toEqual(["bridge"])
  })

  it("was die Brücke meldet, ist Information, keine Aufgabe", () => {
    const model = overviewModel({
      ...base,
      bridge: {
        ...base.bridge!,
        status: "possible-reset",
        heldBack: "2 Scheiben mit verdeckter Wertung nicht geschickt",
      },
    })
    expect(model.tasks).toEqual([])
    const bridge = model.stations.find((s) => s.id === "bridge")!
    expect(bridge).toMatchObject({ status: "aus (nach dem Training normal)", tone: "neutral" })
    expect(bridge.facts).toEqual([
      "Pi im Schützenhaus",
      "zuletzt online 14.10.2026, 22:14",
      "Die Meyton-Anlage wirkt wie neu aufgesetzt. Spiegel trennt alte und neue Scheiben selbst. Du musst nichts tun.",
      "2 Scheiben mit verdeckter Wertung nicht geschickt",
    ])
    expect(
      overviewModel({ ...base, bridge: { ...base.bridge!, online: true } }).stations[1].status
    ).toBe("läuft")
  })

  it("Uhr am Gerät falsch: ein Zustand mit Erklärung, keine Aufgabe (SF-79)", () => {
    const model = overviewModel({
      ...base,
      bridge: { ...base.bridge!, online: true, status: "clock", heldBack: null },
    })
    expect(model.tasks).toEqual([])
    expect(model.stations[1].facts).toEqual([
      "Pi im Schützenhaus",
      "zuletzt online 14.10.2026, 22:14",
      "Die Uhr am Gerät der Brücke geht falsch. Bis sie stimmt, schickt die Brücke keine Scheiben. Meist stellt sich die Uhr nach ein paar Minuten von selbst. Bleibt der Hinweis länger, muss jemand vor Ort die Uhrzeit am Gerät prüfen. Danach kommen alle Scheiben nach.",
    ])
  })

  it("eine unbekannte Ablage ist ein Hinweis an der Anlage, keine Aufgabe", () => {
    const model = overviewModel({ ...base, site: { name: "Schützenhaus", foreignSource: true } })
    expect(model.tasks).toEqual([])
    expect(model.stations[0].tone).toBe("wait")
    expect(model.stations[0].facts[1]).toContain("nimmt sie nicht an")
  })

  it("eine Brücke ohne jeden Kontakt ist nicht „aus (nach dem Training normal)“", () => {
    const model = overviewModel({ ...base, bridge: { ...base.bridge!, lastHeartbeatAt: null } })
    expect(model.stations[1]).toMatchObject({ status: "noch kein Kontakt", tone: "wait" })
  })

  it("Konten gezählt, deaktivierte nur, wenn es welche gibt; dazu die Nutzung", () => {
    expect(overviewModel(base).stations[3].facts).toEqual([
      "12 Konten · 9 mit Sportpass · 1 deaktiviert",
      "124 Scheiben, 9 davon in den letzten 30 Tagen. 4 Konten haben in den letzten 30 Tagen geschossen.",
    ])
    expect(
      overviewModel({
        ...base,
        accounts: { total: 1, deactivated: 0, withSportpass: 0 },
        usage: { cards: 0, recentCards: 0, recentAccounts: 0 },
      }).stations[3].facts
    ).toEqual(["1 Konto · 0 mit Sportpass", "Noch keine Scheibe in Spiegel."])
    expect(
      overviewModel({ ...base, usage: { cards: 1, recentCards: 1, recentAccounts: 1 } }).stations[3]
        .facts[1]
    ).toBe(
      "1 Scheibe, 1 davon in den letzten 30 Tagen. 1 Konto hat in den letzten 30 Tagen geschossen."
    )
    // ohne frische Scheiben kein „0 davon … 0 Konten haben“
    expect(
      overviewModel({ ...base, usage: { cards: 12, recentCards: 0, recentAccounts: 0 } })
        .stations[3].facts[1]
    ).toBe("12 Scheiben, keine davon in den letzten 30 Tagen.")
  })

  it("gemeldete „nicht meine“ als Zahl an den Zustimmungen, ohne Namen und ohne Aufgabe", () => {
    const facts = (notMine: number) =>
      overviewModel({ ...base, notMine }).stations.find((s) => s.id === "consents")!.facts
    expect(facts(0)).toHaveLength(1)
    expect(facts(1)[1]).toBe(
      "1 Scheibe wurde als „nicht meine“ zurückgewiesen. Sie kommt nicht wieder. Am Konto kannst du sie wieder zulassen, solange die Nummer dort steht."
    )
    expect(facts(3)[1]).toBe(
      "3 Scheiben wurden als „nicht meine“ zurückgewiesen. Sie kommen nicht wieder. Am Konto kannst du sie wieder zulassen, solange die Nummer dort steht."
    )
    expect(overviewModel({ ...base, notMine: 3 }).tasks).toEqual([])
  })

  it("ältere Scheiben, die die Brücke noch nachlädt, als Zustand an den Zustimmungen", () => {
    const facts = (historyPending: number) =>
      overviewModel({ ...base, historyPending }).stations.find((s) => s.id === "consents")!.facts
    expect(facts(0)).toHaveLength(1)
    expect(facts(1)[1]).toBe(
      "Für 1 Schützen holt Spiegel noch ältere Scheiben. Das passiert, sobald die Meyton-Anlage an ist."
    )
    expect(facts(2)[1]).toBe(
      "Für 2 Schützen holt Spiegel noch ältere Scheiben. Das passiert, sobald die Meyton-Anlage an ist."
    )
    expect(overviewModel({ ...base, historyPending: 2 }).tasks).toEqual([])
  })

  it("„Für N Schützen“ zählt Konten, nicht Nummern; nur aktive, noch nicht geholte", () => {
    const at = new Date(Date.UTC(2026, 9, 1))
    const row = (
      userId: string,
      more: Partial<Parameters<typeof accountsLoadingHistory>[0][number]>
    ) => ({
      userId,
      confirmedAt: at,
      rejectedAt: null,
      returnedAt: null,
      historyLoadedAt: null,
      ...more,
    })
    expect(
      accountsLoadingHistory([
        row("a", {}),
        row("a", {}),
        row("b", {}),
        row("c", { historyLoadedAt: at }),
        row("d", { confirmedAt: null }),
        row("e", { rejectedAt: at }),
      ])
    ).toBe(2)
  })

  it("Schreibregeln: kein Text der Übersicht mit Semikolon oder altem Wort", () => {
    const model = overviewModel({
      ...base,
      site: { name: "Schützenhaus", foreignSource: true },
      bridge: { ...base.bridge!, status: "possible-reset", heldBack: null },
      consents: [consent(1, "requested"), consent(3, "returned")],
      notMine: 2,
      historyPending: 1,
    })
    // dazu die Aufgaben „Anlage einrichten“ und „Brücke verbinden“
    const setup = overviewModel({ ...base, site: null, bridge: null })
    const texts = [
      ...model.tasks.flatMap((t) => [t.title, t.detail, t.action]),
      ...setup.tasks.flatMap((t) => [t.title, t.detail, t.action]),
      ...setup.stations.flatMap((s) => [s.status, ...s.facts]),
      ...model.stations.flatMap((s) => [s.title, s.does, s.status, ...s.facts]),
    ]
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
    for (const status of ["delayed", "db-unreachable", "db-error", "clock"] as const)
      for (const fact of overviewModel({ ...base, bridge: { ...base.bridge!, status } }).stations[1]
        .facts)
        expect(fact).not.toMatch(OLD_WORDS)
  })
})

describe("Aufgabe für neue Disziplinen", () => {
  const task = (disciplines: Input["disciplines"]) =>
    overviewModel({ ...base, disciplines }).tasks.find((t) => t.id === "disciplines")

  it("wartende Scheiben gehen vor, sonst prüfen, ohne neue keine", () => {
    expect(task({ waiting: 1, suggested: 3 })).toEqual({
      id: "disciplines",
      title: "Eine neue Disziplin: Scheiben warten",
      detail: "Spiegel zeigt diese Scheiben erst, wenn du die Disziplin einordnest.",
      href: "/admin/disciplines",
      action: "Einordnen",
    })
    expect(task({ waiting: 2, suggested: 0 })?.title).toBe("2 neue Disziplinen: Scheiben warten")
    expect(task({ waiting: 0, suggested: 1 })).toEqual({
      id: "disciplines",
      title: "Eine neue Disziplin prüfen",
      detail: "Spiegel hat sie selbst eingeordnet. Ein kurzer Blick reicht.",
      href: "/admin/disciplines",
      action: "Prüfen",
    })
    expect(task({ waiting: 0, suggested: 39 })?.title).toBe("39 neue Disziplinen prüfen")
    expect(task({ waiting: 0, suggested: 0 })).toBeUndefined()
  })

  it("keine alten Wörter", () => {
    for (const disciplines of [
      { waiting: 1, suggested: 0 },
      { waiting: 0, suggested: 2 },
    ])
      expect(JSON.stringify(task(disciplines))).not.toMatch(OLD_WORDS)
  })
})
