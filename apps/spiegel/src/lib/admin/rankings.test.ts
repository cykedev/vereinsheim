import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writeRevision } from "../db/cards"

const mocks = vi.hoisted(() => ({ checked: 0 }))
vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: async () => {
    mocks.checked++
    return {}
  },
}))

const { rankingDetail, rankingOverview } = await import("./rankings")

const tag = randomUUID().slice(0, 8)
let siteId: number
let createdSite: number | null = null
let disciplineId: number
let ownerId: string
let other: TestSite
const rankings: Record<string, number> = {}

/** eine Scheibe ohne Quelle in einer Liste der ersten Anlage, am Tag `day` im Oktober 2026 */
async function card(rankingId: number, seed: number, day: number, deleted = false) {
  const generated = generateSeason({
    seed,
    cards: 12,
    firstMs: Date.UTC(2026, 9, day, 18),
    everyDays: 1,
    sourceId: 0,
    disciplineId,
    ownerId,
    scheibenIdBase: 0,
  }).find((c) => c.shots.some((shot) => shot.stellung !== 0))!
  const { cardId } = await writeRevision(db, {
    ...generated,
    card: { ...generated.card, sourceId: null, scheibenId: null, origin: "pdf" },
  })
  await db.card.update({
    where: { id: cardId },
    data: { rankingId, ...(deleted && { deletedAt: new Date() }) },
  })
}

beforeAll(async () => {
  ownerId = (
    await db.user.create({ data: { email: `schuetze-${tag}@example.com`, passwordHash: "-" } })
  ).id
  const first = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (first) siteId = first.id
  else
    siteId = createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
  disciplineId = (
    await db.discipline.create({
      data: { siteId, meytonId: 10_210_040, name: `LP 40 ${tag}`, targetId: "lp-10m" },
    })
  ).id
  rankings.rwk = (
    await db.ranking.create({ data: { siteId, name: `RWK ${tag}`, kind: "competition" } })
  ).id
  rankings.empty = (await db.ranking.create({ data: { siteId, name: `Leer ${tag}` } })).id
  await card(rankings.rwk, 1, 2)
  await card(rankings.rwk, 2, 9)
  await card(rankings.rwk, 3, 20, true)
  other = await createTestSite(db, "rankings-other")
  rankings.foreign = (
    await db.ranking.create({ data: { siteId: other.siteId, name: `Fremd ${tag}` } })
  ).id
})
afterAll(async () => {
  await db.card.deleteMany({ where: { disciplineId } })
  await db.discipline.delete({ where: { id: disciplineId } })
  await db.ranking.deleteMany({ where: { id: { in: [rankings.rwk, rankings.empty] } } })
  await other.remove()
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})

const mine = async () =>
  (await rankingOverview("Europe/Berlin")).filter((r) => r.name.includes(tag))

describe("rankingOverview", () => {
  it("je Liste Art, Zahl ohne gelöschte und der Monat der letzten Scheibe", async () => {
    expect(await mine()).toEqual([
      { id: rankings.empty, name: `Leer ${tag}`, kind: null, cards: 0, lastCardMonth: null },
      {
        id: rankings.rwk,
        name: `RWK ${tag}`,
        kind: "competition",
        cards: 2,
        lastCardMonth: "Oktober 2026",
      },
    ])
  })

  it("nur Listen der ersten Anlage", async () => {
    expect((await rankingOverview("Europe/Berlin")).map((r) => r.id)).not.toContain(
      rankings.foreign
    )
  })
})

describe("rankingDetail", () => {
  it("eine Liste der ersten Anlage mit ihren Zahlen", async () => {
    expect(await rankingDetail(rankings.rwk, "Europe/Berlin")).toMatchObject({
      name: `RWK ${tag}`,
      cards: 2,
    })
  })

  it("eine Liste einer anderen Anlage oder eine unbekannte gibt es nicht", async () => {
    expect(await rankingDetail(rankings.foreign, "Europe/Berlin")).toBeNull()
    expect(await rankingDetail(2_000_000_000, "Europe/Berlin")).toBeNull()
  })

  it("jede Abfrage prüft selbst, ob ein Admin fragt", async () => {
    const before = mocks.checked
    await rankingOverview("Europe/Berlin")
    await rankingDetail(rankings.rwk, "Europe/Berlin")
    expect(mocks.checked - before).toBe(2)
  })
})
