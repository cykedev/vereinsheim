import { randomBytes, randomInt, randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { pairBridge, removeBridgeAction, revokeBridgeAction, saveSite, setRankingKind } =
  await import("./site-actions")

const tag = randomUUID().slice(0, 8)
let adminId: string
let shooterId: string
let createdSite: number | null = null

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeAll(async () => {
  adminId = (
    await db.user.create({
      data: { email: `admin-${tag}@example.com`, passwordHash: "-", role: "ADMIN" },
    })
  ).id
  shooterId = (
    await db.user.create({ data: { email: `schuetze-${tag}@example.com`, passwordHash: "-" } })
  ).id
  // die Actions arbeiten auf der ersten Anlage; gibt es keine, legt der Test eine an und räumt sie weg
  if (!(await db.site.findFirst({ select: { id: true } })))
    createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
})
afterAll(async () => {
  await db.bridgePairing.deleteMany({ where: { name: `Pi ${tag}` } })
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: adminId, role: "ADMIN" } }
})

describe("Zeitzone der Anlage (Review P2c)", () => {
  it("fest, sobald es Scheiben gibt: eine andere wird abgelehnt, die gespeicherte bleibt", async () => {
    const site = await db.site.findFirstOrThrow({ orderBy: { id: "asc" } })
    const epoch = 900 + randomInt(99)
    const source = await db.source.create({
      data: { siteId: site.id, epoch, confirmedAt: new Date() },
    })
    const discipline = await db.discipline.create({
      data: { siteId: site.id, meytonId: 990_000 + randomInt(9_999), name: `Zone ${tag}` },
    })
    const card = await db.card.create({
      data: {
        sourceId: source.id,
        scheibenId: 1,
        disciplineId: discipline.id,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "raw",
      },
    })
    try {
      const other = site.timeZone === "Europe/Vienna" ? "Europe/Berlin" : "Europe/Vienna"
      expect(await saveSite(null, form({ name: site.name, timeZone: other }))).toEqual({
        error: {
          timeZone: ["Die Zeitzone lässt sich nicht mehr ändern, weil schon Scheiben da sind."],
        },
      })
      expect((await db.site.findUniqueOrThrow({ where: { id: site.id } })).timeZone).toBe(
        site.timeZone
      )
      // der Name allein lässt sich weiter ändern
      expect(await saveSite(null, form({ name: site.name, timeZone: site.timeZone }))).toEqual({
        success: true,
      })
    } finally {
      await db.card.delete({ where: { id: card.id } })
      await db.discipline.delete({ where: { id: discipline.id } })
      await db.source.delete({ where: { id: source.id } })
    }
  })
})

describe("Anlage und Brücken (Admin)", () => {
  it("nur ein Admin, der sein Passwort schon ersetzt hat", async () => {
    mocks.session = { user: { id: shooterId, role: "USER" } }
    expect(await pairBridge(null, form({ name: "x" }))).toEqual({
      error: "Das darf nur ein Admin.",
    })
    expect(await revokeBridgeAction(1)).toEqual({ error: "Das darf nur ein Admin." })
    expect(await removeBridgeAction(1)).toEqual({ error: "Das darf nur ein Admin." })
    mocks.session = { user: { id: adminId, role: "ADMIN", mustChangePassword: true } }
    expect(await saveSite(null, form({}))).toEqual({
      error: "Bitte zuerst das eigene Passwort ändern.",
    })
  })

  it("Zeitzone wird geprüft, bevor etwas geschrieben wird", async () => {
    const result = await saveSite(null, form({ name: "Verein", timeZone: "Mond/Krater" }))
    expect(result).toEqual({
      error: { timeZone: ["Diese Zeitzone kennt Spiegel nicht. In Deutschland: Europe/Berlin."] },
    })
  })

  it("eine getrennte Brücke entfernen, eine laufende nicht (User, 15. Oktober 2026)", async () => {
    const site = await db.site.findFirstOrThrow({ orderBy: { id: "asc" } })
    const bridge = (name: string, revokedAt: Date | null) =>
      db.bridge.create({
        data: { siteId: site.id, name, tokenHash: randomBytes(32).toString("hex"), revokedAt },
      })
    // aufräumen auch, wenn eine Erwartung oder das Anlegen scheitert: Die Brücken liegen auf der ersten Dev-Anlage (Review)
    const made: number[] = []
    try {
      const running = await bridge(`Läuft ${tag}`, null)
      made.push(running.id)
      const revoked = await bridge(`Getrennt ${tag}`, new Date())
      made.push(revoked.id)
      expect(await removeBridgeAction(running.id)).toEqual({
        error: "Diese Brücke ist nicht getrennt. Lade die Seite neu.",
      })
      expect(await removeBridgeAction(revoked.id)).toEqual({ success: true })
      expect(await db.bridge.count({ where: { id: { in: [running.id, revoked.id] } } })).toBe(1)
      const gone = { error: "Diese Brücke gibt es nicht mehr. Lade die Seite neu." }
      expect(await removeBridgeAction(revoked.id)).toEqual(gone)
      expect(await removeBridgeAction(Number.NaN)).toEqual(gone)
      // eine Kennung über dem Bereich der Spalte: kein Fehler der Datenbank, sondern die Meldung (Review)
      expect(await removeBridgeAction(2 ** 40)).toEqual(gone)
      expect(await revokeBridgeAction(2 ** 40)).toEqual({
        error: "Diese Brücke gibt es nicht mehr. Lade die Seite neu.",
      })
    } finally {
      await db.bridge.deleteMany({ where: { id: { in: made } } })
    }
  })

  it("„Brücke koppeln“ gibt einen Code mit Uhrzeit, gespeichert ist nur sein Hash", async () => {
    const result = await pairBridge(null, form({ name: `Pi ${tag}` }))
    if (!("success" in result) || !result.data) throw new Error(JSON.stringify(result))
    expect(result.data.code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/)
    expect(result.data.until).toMatch(/^\d\d:\d\d$/)
    const stored = await db.bridgePairing.findFirstOrThrow({ where: { name: `Pi ${tag}` } })
    expect(stored.createdById).toBe(adminId)
    expect(JSON.stringify(stored)).not.toContain(result.data.code.replace("-", ""))
  })
})

describe("Art einer Rangliste (Admin)", () => {
  it("Wettkampf, Training oder offen; nur ein Admin, nur bekannte Arten", async () => {
    const site = await db.site.findFirstOrThrow({ orderBy: { id: "asc" }, select: { id: true } })
    const ranking = await db.ranking.create({ data: { siteId: site.id, name: `RWK ${tag}` } })
    try {
      expect(await setRankingKind(ranking.id, "competition")).toEqual({ success: true })
      expect((await db.ranking.findUniqueOrThrow({ where: { id: ranking.id } })).kind).toBe(
        "competition"
      )
      expect(await setRankingKind(ranking.id, "open")).toEqual({ success: true })
      expect((await db.ranking.findUniqueOrThrow({ where: { id: ranking.id } })).kind).toBeNull()
      expect(await setRankingKind(ranking.id, "liga")).toEqual({
        error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
      })
      expect(await setRankingKind(-1, "training")).toEqual({
        error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
      })
      mocks.session = { user: { id: shooterId, role: "USER" } }
      expect(await setRankingKind(ranking.id, "training")).toEqual({
        error: "Das darf nur ein Admin.",
      })
      expect((await db.ranking.findUniqueOrThrow({ where: { id: ranking.id } })).kind).toBeNull()
    } finally {
      await db.ranking.delete({ where: { id: ranking.id } })
    }
  })
})
