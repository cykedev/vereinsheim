import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
  revalidated: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => void mocks.revalidated++ }))

const { setCardDiscipline } = await import("./card-discipline-actions")

let site: TestSite
let own: string
let trash: string
let auflage: number
let rifle: number

beforeAll(async () => {
  site = await createTestSite(db, "discipline-action")
  auflage = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_211_030,
        name: "LP Auflage 30",
        targetId: "lp-10m",
        familyId: site.familyId,
        confirmedAt: new Date(),
      },
    })
  ).id
  rifle = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_110_040,
        name: "LG 40",
        targetId: "lg-10m",
        familyId: site.familyId,
        confirmedAt: new Date(),
      },
    })
  ).id
  const cards = generateSeason({
    seed: 17,
    cards: 6,
    firstMs: Date.UTC(2026, 4, 5, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 6800,
  }).filter((c) => c.shots.some((s) => s.stellung !== 0))
  if (cards.length < 2) throw new Error("keine passende Scheibe im Seed")
  own = (await writeRevision(db, cards[0])).cardId
  trash = (await writeRevision(db, cards[1])).cardId
  await db.card.update({ where: { id: trash }, data: { deletedAt: new Date() } })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const disciplineOf = async (cardId: string) =>
  (await db.card.findUniqueOrThrow({ where: { id: cardId } })).disciplineId

describe("setCardDiscipline", () => {
  it("speichert die Disziplin der eigenen Scheibe und stellt zurück; ohne `revalidatePath`", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const before = mocks.revalidated
    expect(await setCardDiscipline(own, auflage)).toEqual({ success: true })
    expect(await disciplineOf(own)).toBe(auflage)
    expect(await setCardDiscipline(own, site.disciplineId)).toEqual({ success: true })
    expect(await disciplineOf(own)).toBe(site.disciplineId)
    expect(mocks.revalidated).toBe(before)
  })

  it("fremde, gelöschte, unbekannte Scheiben und unpassende Disziplinen nicht", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const missing = { error: "Diese Scheibe gibt es nicht mehr." }
    expect(await setCardDiscipline(trash, auflage)).toEqual(missing)
    expect(await setCardDiscipline("gibt-es-nicht", auflage)).toEqual(missing)
    expect(await setCardDiscipline(42 as unknown as string, auflage)).toEqual(missing)
    expect(await setCardDiscipline(own, rifle)).toEqual({
      error: "Diese Disziplin passt nicht zu der Scheibe. Bitte lade die Seite neu.",
    })
    for (const bad of [0, -1, 1.5, "7" as unknown as number, 2 ** 31])
      expect(await setCardDiscipline(own, bad)).toEqual({
        error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
      })
    expect(await disciplineOf(own)).toBe(site.disciplineId)

    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await setCardDiscipline(own, auflage)).toEqual(missing)
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect(await setCardDiscipline(own, auflage)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = null
    expect(await setCardDiscipline(own, auflage)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    expect(await disciplineOf(own)).toBe(site.disciplineId)
  })
})
