import { randomInt, randomUUID } from "node:crypto"

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

const { addSportpass, pairBridge, removeSportpass, revokeBridgeAction, saveSite } =
  await import("./site-actions")

const tag = randomUUID().slice(0, 8)
let adminId: string
let shooterId: string
let createdSite: number | null = null
/** eine SportpassID, die es in der Dev-Datenbank sicher nicht gibt (über zwölf Stellen hinaus nicht möglich) */
const sportpass = String(900_000_000_000 + randomInt(99_999_999))

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

describe("Anlage und Brücken (Admin)", () => {
  it("nur ein Admin, der sein Passwort schon ersetzt hat", async () => {
    mocks.session = { user: { id: shooterId, role: "USER" } }
    expect(await pairBridge(null, form({ name: "x" }))).toEqual({ error: "Keine Berechtigung" })
    expect(await revokeBridgeAction(1)).toEqual({ error: "Keine Berechtigung" })
    mocks.session = { user: { id: adminId, role: "ADMIN", mustChangePassword: true } }
    expect(await saveSite(null, form({}))).toEqual({
      error: "Bitte zuerst das eigene Passwort ändern.",
    })
  })

  it("Zeitzone wird geprüft, bevor etwas geschrieben wird", async () => {
    const result = await saveSite(null, form({ name: "Verein", timeZone: "Mond/Krater" }))
    expect(result).toEqual({ error: { timeZone: ["Unbekannte Zeitzone, etwa Europe/Berlin."] } })
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

describe("SportpassIDs mit Zustimmung (Admin)", () => {
  it("eintragen, doppelt abgelehnt, entfernen; nur Ziffern bis zwölf Stellen", async () => {
    expect(await addSportpass(shooterId, null, form({ sportpass: "12a" }))).toEqual({
      error: { sportpass: ["Eine SportpassID hat bis zu zwölf Ziffern."] },
    })
    expect(await addSportpass(shooterId, null, form({ sportpass }))).toEqual({ success: true })
    const consent = await db.sportpassConsent.findFirstOrThrow({ where: { userId: shooterId } })
    expect(consent.sportpassId.toString()).toBe(sportpass)
    expect(consent.confirmedAt).not.toBeNull()
    expect(await addSportpass(adminId, null, form({ sportpass }))).toEqual({
      error: { sportpass: ["Diese SportpassID gehört schon zu einem Konto."] },
    })
    expect(await removeSportpass(consent.id)).toEqual({ success: true })
    expect(await db.sportpassConsent.count({ where: { userId: shooterId } })).toBe(0)
    expect(await removeSportpass(consent.id)).toEqual({ error: "Unbekannte Zustimmung." })
  })
})
