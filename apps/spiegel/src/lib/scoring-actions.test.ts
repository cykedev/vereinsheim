import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"
import { familyScorings } from "./db/reads"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
  revalidated: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => void mocks.revalidated++ }))

const { setCardScoring, setFamilyScoring } = await import("./scoring-actions")

let site: TestSite
let own: string
let trash: string
let familySlug: string
let emptyFamilyId: number
let emptySlug: string

beforeAll(async () => {
  site = await createTestSite(db, "scoring-action")
  const [a, b] = generateSeason({
    seed: 12,
    cards: 2,
    firstMs: Date.UTC(2026, 4, 3, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 6000,
  })
  own = (await writeRevision(db, a)).cardId
  trash = (await writeRevision(db, b)).cardId
  await db.card.update({ where: { id: trash }, data: { deletedAt: new Date() } })
  familySlug = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).slug
  // eine Familie ohne Scheiben des Schützen
  emptySlug = `${familySlug}-leer`
  emptyFamilyId = (await db.family.create({ data: { slug: emptySlug, name: "Leer" } })).id
})
afterAll(async () => {
  await site.remove()
  await db.family.delete({ where: { id: emptyFamilyId } })
  await db.$disconnect()
})

const choiceOf = async (cardId: string) =>
  (await db.card.findUniqueOrThrow({ where: { id: cardId } })).scoringChoice

describe("setCardScoring", () => {
  it("speichert die Wahl der eigenen Scheibe; fremde, gelöschte und unbekannte nicht", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const before = mocks.revalidated
    expect(await setCardScoring(own, "rings")).toEqual({ success: true })
    expect(await choiceOf(own)).toBe("rings")
    expect(mocks.revalidated).toBe(before + 1)
    expect(await setCardScoring(own, "decimal")).toEqual({ success: true })
    expect(await choiceOf(own)).toBe("decimal")

    const missing = { error: "Die Scheibe gibt es nicht." }
    expect(await setCardScoring(trash, "rings")).toEqual(missing)
    expect(await choiceOf(trash)).toBeNull()
    expect(await setCardScoring("gibt-es-nicht", "rings")).toEqual(missing)
    expect(await setCardScoring(42 as unknown as string, "rings")).toEqual(missing)
    expect(await setCardScoring(own, "teiler" as "rings")).toEqual({
      error: "Unbekannte Wertung.",
    })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await setCardScoring(own, "rings")).toEqual(missing)
    expect(await choiceOf(own)).toBe("decimal")
  })

  it("ohne Sitzung oder mit Passwort vom Admin ein Fehler", async () => {
    mocks.session = null
    expect(await setCardScoring(own, "rings")).toEqual({ error: "Nicht angemeldet" })
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect(await setCardScoring(own, "rings")).toEqual({ error: "Nicht angemeldet" })
    expect(await choiceOf(own)).toBe("decimal")
  })
})

describe("setFamilyScoring", () => {
  it("speichert die Wertung einer Familie mit eigenen Scheiben und überschreibt sie", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await setFamilyScoring(familySlug, "rings")).toEqual({ success: true })
    expect(await familyScorings(db, site.ownerId)).toEqual({ [familySlug]: "rings" })
    expect(await setFamilyScoring(familySlug, "decimal")).toEqual({ success: true })
    expect(await familyScorings(db, site.ownerId)).toEqual({ [familySlug]: "decimal" })
  })

  it("eine unbekannte Familie oder eine ohne eigene Scheiben nicht; ohne Sitzung ein Fehler", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const missing = { error: "Die Familie gibt es nicht." }
    expect(await setFamilyScoring(emptySlug, "rings")).toEqual(missing)
    expect(await setFamilyScoring("gibt-es-nicht", "rings")).toEqual(missing)
    expect(await setFamilyScoring(null as unknown as string, "rings")).toEqual(missing)
    expect(await setFamilyScoring(familySlug, "x" as "rings")).toEqual({
      error: "Unbekannte Wertung.",
    })
    mocks.session = { user: { id: "jemand-anderes", role: "USER" } }
    expect(await setFamilyScoring(familySlug, "rings")).toEqual(missing)
    mocks.session = null
    expect(await setFamilyScoring(familySlug, "rings")).toEqual({ error: "Nicht angemeldet" })
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await familyScorings(db, site.ownerId)).toEqual({ [familySlug]: "decimal" })
  })
})
