import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { cardMarks } from "@vereinsheim/shot-core/projection"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { toMetricShot, writeRevision } from "./db/cards"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))

const { cardMarksAction } = await import("./marks-actions")

let site: TestSite
let own: string
let trash: string
let shots: ReturnType<typeof toMetricShot>[]

beforeAll(async () => {
  site = await createTestSite(db, "marks-action")
  const [a, b] = generateSeason({
    seed: 11,
    cards: 2,
    firstMs: Date.UTC(2026, 4, 1, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 5000,
  })
  own = (await writeRevision(db, a)).cardId
  shots = a.shots.map(toMetricShot)
  trash = (await writeRevision(db, b)).cardId
  await db.card.update({ where: { id: trash }, data: { deletedAt: new Date() } })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

describe("cardMarksAction", () => {
  it("die Lagen der eigenen Scheibe; fremde, gelöschte, unbekannte und ohne Sitzung keine", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await cardMarksAction(own)).toEqual(cardMarks(shots))
    expect(await cardMarksAction(trash)).toBeNull()
    expect(await cardMarksAction("gibt-es-nicht")).toBeNull()
    expect(await cardMarksAction(42 as unknown as string)).toBeNull()
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await cardMarksAction(own)).toBeNull()
    mocks.session = null
    expect(await cardMarksAction(own)).toBeNull()
  })
})
