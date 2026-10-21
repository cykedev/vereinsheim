import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))

const { periodPatternAction } = await import("./pattern-actions")

let site: TestSite
const own: string[] = []
let trash: string

beforeAll(async () => {
  site = await createTestSite(db, "pattern-action")
  const inputs = generateSeason({
    seed: 12,
    cards: 4,
    firstMs: Date.UTC(2026, 4, 1, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 5100,
  })
  for (const input of inputs.slice(0, 3)) own.push((await writeRevision(db, input)).cardId)
  trash = (await writeRevision(db, inputs[3])).cardId
  await db.card.update({ where: { id: trash }, data: { deletedAt: new Date() } })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

describe("periodPatternAction", () => {
  it("rechnet über die eigenen, nicht gelöschten Scheiben", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const result = await periodPatternAction([...own, trash])
    expect(result).toHaveProperty("success", true)
    const pattern = "success" in result ? result.data : undefined
    expect(pattern?.cards).toBe(3)
    expect(pattern?.shots).toBeGreaterThan(0)
    expect(pattern?.overTime.points.map((p) => p.id).sort()).toEqual([...own].sort())
  })

  it("fremde Scheiben fallen still weg, auch für Admins", async () => {
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    const result = await periodPatternAction(own)
    expect("success" in result && result.data?.cards).toBe(0)
  })

  it("ungültige Eingaben, zu viele Kennungen und fehlende Sitzung sind Fehler", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await periodPatternAction("x")).toHaveProperty("error")
    expect(await periodPatternAction(["../x"])).toHaveProperty("error")
    expect(await periodPatternAction([42])).toHaveProperty("error")
    expect(await periodPatternAction(new Array(5001).fill(own[0]))).toHaveProperty("error")
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect(await periodPatternAction(own)).toHaveProperty("error")
    mocks.session = null
    expect(await periodPatternAction(own)).toHaveProperty("error")
  })
})
