import { randomInt, randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { createTestSite, type TestSite } from "../../../test/fixtures"

import { consentStatus } from "./status"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { confirmConsent, rejectConsent, removeConsent, requestSportpass, revokeSportpass } =
  await import("./actions")

const tag = randomUUID().slice(0, 8)
let adminId: string
let shooterId: string
let otherId: string
let createdSite: number | null = null
let cardSite: TestSite
/** SportpassIDs, die es in der Dev-Datenbank sicher nicht gibt */
const sportpass = () => String(900_000_000_000 + randomInt(99_999_999))

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const asShooter = (id = shooterId) => {
  mocks.session = { user: { id, role: "USER" } }
}
const asAdmin = () => {
  mocks.session = { user: { id: adminId, role: "ADMIN" } }
}
/** eine Zustimmung des Schützen, wie sie das Profil anlegt */
async function requested(userId = shooterId) {
  asShooter(userId)
  const id = sportpass()
  expect(await requestSportpass(null, form({ sportpass: id, agree: "on" }))).toEqual({
    success: true,
  })
  return db.sportpassConsent.findFirstOrThrow({
    where: { userId, sportpassId: BigInt(id) },
  })
}

beforeAll(async () => {
  const user = (email: string, role: "ADMIN" | "USER" = "USER") =>
    db.user.create({ data: { email, passwordHash: "-", role } }).then((u) => u.id)
  adminId = await user(`admin-${tag}@example.com`, "ADMIN")
  shooterId = await user(`schuetze-${tag}@example.com`)
  otherId = await user(`andere-${tag}@example.com`)
  // die Actions arbeiten auf der ersten Anlage; gibt es keine, legt der Test eine an und räumt sie weg
  if (!(await db.site.findFirst({ select: { id: true } })))
    createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
  cardSite = await createTestSite(db, "zustimmung")
})
afterAll(async () => {
  await cardSite.remove()
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = null
})

describe("Zustimmung durch den Schützen", () => {
  it("legt eine wartende Zustimmung mit der Version des Hinweistexts an", async () => {
    const consent = await requested()
    expect(consentStatus(consent)).toBe("requested")
    expect(consent.consentVersion).toBe("v1")
    expect(consent.confirmedAt).toBeNull()
  })

  it("ohne Haken keine Zeile, sondern ein Feldfehler", async () => {
    asShooter()
    const id = sportpass()
    expect(await requestSportpass(null, form({ sportpass: id }))).toEqual({
      error: { agree: ["Bitte dem Hinweis zustimmen."] },
    })
    expect(await db.sportpassConsent.count({ where: { sportpassId: BigInt(id) } })).toBe(0)
  })

  it("nur Ziffern bis zwölf Stellen, ohne Anmeldung nichts", async () => {
    asShooter()
    expect(await requestSportpass(null, form({ sportpass: "12a", agree: "on" }))).toEqual({
      error: { sportpass: ["Eine SportpassID hat bis zu zwölf Ziffern."] },
    })
    mocks.session = null
    expect(await requestSportpass(null, form({ sportpass: sportpass(), agree: "on" }))).toEqual({
      error: "Nicht angemeldet",
    })
  })

  it("höchstens drei SportpassIDs je Konto", async () => {
    const userId = otherId
    await requested(userId)
    await requested(userId)
    await requested(userId)
    asShooter(userId)
    expect(await requestSportpass(null, form({ sportpass: sportpass(), agree: "on" }))).toEqual({
      error: { sportpass: ["Höchstens drei SportpassIDs je Konto."] },
    })
    await db.sportpassConsent.deleteMany({ where: { userId } })
  })

  it("eine vergebene SportpassID verrät nicht, wem sie gehört", async () => {
    const taken = await requested(otherId)
    asShooter()
    expect(
      await requestSportpass(null, form({ sportpass: taken.sportpassId.toString(), agree: "on" }))
    ).toEqual({
      error: { sportpass: ["Diese SportpassID ist schon vergeben. Wende dich an einen Admin."] },
    })
    await db.sportpassConsent.delete({ where: { id: taken.id } })
  })
})

describe("Widerruf", () => {
  it("nur die eigene; eine fremde bleibt", async () => {
    const foreign = await requested(otherId)
    asShooter()
    expect(await revokeSportpass(foreign.id)).toEqual({ error: "Unbekannte Zustimmung." })
    expect(await db.sportpassConsent.count({ where: { id: foreign.id } })).toBe(1)
    asShooter(otherId)
    expect(await revokeSportpass(foreign.id)).toEqual({ success: true })
    expect(await db.sportpassConsent.count({ where: { id: foreign.id } })).toBe(0)
  })

  it("die hochgeladenen Scheiben bleiben beim Schützen", async () => {
    const consent = await requested()
    const card = await db.card.create({
      data: {
        ownerId: shooterId,
        disciplineId: cardSite.disciplineId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "raw",
      },
    })
    asShooter()
    expect(await revokeSportpass(consent.id)).toEqual({ success: true })
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).ownerId).toBe(shooterId)
    await db.card.delete({ where: { id: card.id } })
  })
})

describe("Entscheidung des Admins", () => {
  it("nur ein Admin bestätigt; zweimal ist schon entschieden", async () => {
    const consent = await requested()
    asShooter()
    expect(await confirmConsent(consent.id)).toEqual({ error: "Keine Berechtigung" })
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    const active = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(active)).toBe("active")
    expect(await confirmConsent(consent.id)).toEqual({ error: "Schon entschieden." })
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })

  it("ablehnen, auch nach dem Bestätigen; danach kein Bestätigen mehr", async () => {
    const consent = await requested()
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    expect(await rejectConsent(consent.id)).toEqual({ success: true })
    const rejected = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(rejected)).toBe("rejected")
    expect(rejected.confirmedAt).toBeNull()
    expect(await rejectConsent(consent.id)).toEqual({ error: "Schon entschieden." })
    expect(await confirmConsent(consent.id)).toEqual({ error: "Schon entschieden." })
    // der Schütze entfernt die Ablehnung und kann neu eintragen
    asShooter()
    expect(await revokeSportpass(consent.id)).toEqual({ success: true })
  })

  it("eine zurückgegebene wird beim Bestätigen wieder aktiv", async () => {
    const consent = await requested()
    await db.sportpassConsent.update({
      where: { id: consent.id },
      data: { returnedAt: new Date() },
    })
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    const active = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(active)).toBe("active")
    expect(active.returnedAt).toBeNull()
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })

  it("entfernen; eine unbekannte Kennung ist ein Fehler", async () => {
    const consent = await requested()
    asAdmin()
    expect(await removeConsent(consent.id)).toEqual({ success: true })
    expect(await removeConsent(consent.id)).toEqual({ error: "Unbekannte Zustimmung." })
    expect(await confirmConsent(-1)).toEqual({ error: "Unbekannte Zustimmung." })
  })
})
