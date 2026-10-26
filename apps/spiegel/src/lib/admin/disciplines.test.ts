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

const { disciplineDetail, disciplineOverview, disciplineTaskCounts } = await import("./disciplines")

const tag = randomUUID().slice(0, 8)
let siteId: number
let createdSite: number | null = null
let familyId: number
let other: TestSite
const owners: string[] = []
const disciplines: Record<string, number> = {}

/** eine Scheibe ohne Quelle (wie aus dem Ausdruck) in einer Disziplin der ersten Anlage */
async function card(disciplineId: number, ownerId: string, seed: number, deleted = false) {
  const generated = generateSeason({
    seed,
    cards: 12,
    firstMs: Date.UTC(2026, 9, 2, 18),
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
  if (deleted) await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
}

beforeAll(async () => {
  for (const n of [1, 2, 3])
    owners.push(
      (
        await db.user.create({
          data: { email: `schuetze${n}-${tag}@example.com`, passwordHash: "-" },
        })
      ).id
    )
  const first = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (first) siteId = first.id
  else
    siteId = createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
  familyId = (await db.family.create({ data: { slug: `test-${tag}`, name: `Familie ${tag}` } })).id
  const create = async (key: string, data: Record<string, unknown>) => {
    disciplines[key] = (
      await db.discipline.create({
        data: { siteId, ...(data as { meytonId: number | null; name: string }) },
      })
    ).id
  }
  await create("lp", {
    meytonId: 10_210_040,
    name: `LP 40 ${tag}`,
    targetId: "lp-10m",
    familyId,
  })
  await create("chess", { meytonId: 18_051_010, name: `LG Schach ${tag}`, ignoredAt: new Date() })
  await create("old", {
    meytonId: 10_210_020,
    name: `LP 20 ${tag}`,
    targetId: "lp-10m",
    familyId,
    plannedShots: 7,
    confirmedAt: new Date(),
  })
  await create("renamed", {
    meytonId: 10_210_020,
    name: `LP 20 neu ${tag}`,
    targetId: "lp-10m",
    familyId,
    plannedShots: 7,
  })
  await create("unknown", { meytonId: 10_199_005, name: `Zimmerstutzen ${tag}` })
  // ohne Nummer, mit denselben Werten wie eine eingeordnete ohne Nummer und wie „old“: keine umbenannte
  const free = { meytonId: null, targetId: "lp-10m", familyId, plannedShots: 7 }
  await create("freeOld", { ...free, name: `LP frei alt ${tag}`, confirmedAt: new Date() })
  await create("free", { ...free, name: `LP frei ${tag}` })
  await card(disciplines.lp, owners[0], 1)
  await card(disciplines.lp, owners[0], 2)
  await card(disciplines.lp, owners[1], 3)
  await card(disciplines.lp, owners[2], 4, true)
  other = await createTestSite(db, "disciplines-other")
})
afterAll(async () => {
  await db.card.deleteMany({ where: { disciplineId: { in: Object.values(disciplines) } } })
  await db.discipline.deleteMany({ where: { id: { in: Object.values(disciplines) } } })
  await db.family.delete({ where: { id: familyId } })
  await other.remove()
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})

const mine = async () =>
  (await disciplineOverview("Europe/Berlin")).rows.filter((r) => r.name.includes(tag))

describe("disciplineOverview", () => {
  it("Zahlen je Disziplin: gelöschte zählen nicht, Besitzer gezählt, Monat statt Tag", async () => {
    const lp = (await mine()).find((r) => r.id === disciplines.lp)!
    expect(lp.stats.cards).toBe(3)
    expect(lp.stats.owners).toBe(2)
    expect(lp.stats.lastCardMonth).toBe("Oktober 2026")
    expect(lp.stats.scoredCards).toBe(3)
    expect(lp.familyName).toBe(`Familie ${tag}`)
  })

  it("Anzeige am Stand und Schusszahl verlassen den Server erst ab drei Schützen", async () => {
    let lp = (await mine()).find((r) => r.id === disciplines.lp)!
    expect(lp.stats.owners).toBe(2)
    expect(lp.stats.stand).toBeNull()
    expect(lp.stats.shots).toBeNull()
    await card(disciplines.lp, owners[2], 7)
    lp = (await mine()).find((r) => r.id === disciplines.lp)!
    expect(lp.stats.owners).toBe(3)
    expect(lp.stats.stand).not.toBeNull()
    expect(lp.stats.shots?.of).toBe(4)
  })

  it("Zustände, Reihenfolge und die übernommene Zuordnung einer umbenannten", async () => {
    const rows = await mine()
    const byId = (key: string) => rows.find((r) => r.id === disciplines[key])!
    expect(byId("unknown").status).toBe("waiting")
    expect(byId("lp").status).toBe("suggested")
    expect(byId("chess").status).toBe("suggested")
    expect(byId("chess").ignored).toBe(true)
    expect(byId("old").status).toBe("confirmed")
    expect(byId("renamed").suggestion.sibling).toBe(`LP 20 ${tag}`)
    expect(byId("lp").suggestion.sibling).toBeNull()
    expect(byId("free").suggestion.sibling).toBeNull()
    expect(rows[0].id).toBe(disciplines.unknown)
  })

  it("keine Disziplin einer anderen Anlage, keine Namen, Konten oder Tage", async () => {
    const { rows, families } = await disciplineOverview("Europe/Berlin")
    expect(rows.some((r) => r.id === other.disciplineId)).toBe(false)
    const text = JSON.stringify(rows)
    for (const id of owners) expect(text).not.toContain(id)
    expect(text).not.toContain("@example.com")
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(families.find((f) => f.id === familyId)).toMatchObject({ disciplines: 5 })
  })
})

describe("disciplineDetail und disciplineTaskCounts", () => {
  it("jede Abfrage prüft selbst, ob ein Admin fragt", async () => {
    const before = mocks.checked
    await disciplineOverview("Europe/Berlin")
    await disciplineDetail(disciplines.lp, "Europe/Berlin")
    await disciplineTaskCounts()
    expect(mocks.checked - before).toBeGreaterThanOrEqual(3)
  })

  it("eine Disziplin der Anlage, keine fremde", async () => {
    expect((await disciplineDetail(disciplines.lp, "Europe/Berlin"))?.row.name).toBe(`LP 40 ${tag}`)
    expect(await disciplineDetail(other.disciplineId, "Europe/Berlin")).toBeNull()
  })

  it("wartende und vorgeschlagene mit Scheiben", async () => {
    const before = await disciplineTaskCounts()
    await card(disciplines.unknown, owners[0], 5)
    await card(disciplines.chess, owners[0], 6)
    const after = await disciplineTaskCounts()
    expect(after.waiting).toBe(before.waiting + 1)
    expect(after.suggested).toBe(before.suggested + 1)
  })
})
