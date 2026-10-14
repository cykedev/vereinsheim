import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "./cards"
import { isKeyBlocked } from "./blocks"
import { purgeExpiredTrash, TRASH_DAYS, trashEndsAt } from "./trash"

const db = createPrismaClient()
const DAY_MS = 86_400_000
let site: TestSite
let other: string
const ids = { fresh: "", expired: "", kept: "", foreign: "" }

beforeAll(async () => {
  site = await createTestSite(db, "trash")
  other = (
    await db.user.create({
      data: { email: `trash-other-${site.siteId}@example.com`, name: "Anders", passwordHash: "-" },
    })
  ).id
  const cards = generateSeason({
    seed: 21,
    cards: 4,
    firstMs: Date.UTC(2026, 4, 1, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 7100,
  })
  const [fresh, expired, kept, foreign] = await Promise.all(
    cards.map(
      async (c, i) =>
        (await writeRevision(db, i === 3 ? { ...c, card: { ...c.card, ownerId: other } } : c))
          .cardId
    )
  )
  Object.assign(ids, { fresh, expired, kept, foreign })
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

describe("Papierkorb: Ablauf nach 30 Tagen", () => {
  it("30 Tage ab dem Löschen", () => {
    expect(TRASH_DAYS).toBe(30)
    expect(trashEndsAt(new Date(Date.UTC(2026, 9, 1))).toISOString()).toBe(
      "2026-10-31T00:00:00.000Z"
    )
  })

  it("nach 29 Tagen bleibt die Scheibe, nach 31 Tagen ist sie weg und für ihren Besitzer gesperrt", async () => {
    const nowMs = Date.now()
    const at = (days: number) => new Date(nowMs - days * DAY_MS)
    await db.card.update({ where: { id: ids.fresh }, data: { deletedAt: at(29) } })
    await db.card.update({ where: { id: ids.expired }, data: { deletedAt: at(31) } })
    await db.card.update({ where: { id: ids.foreign }, data: { deletedAt: at(31) } })
    const expired = await db.card.findUniqueOrThrow({ where: { id: ids.expired } })
    const foreign = await db.card.findUniqueOrThrow({ where: { id: ids.foreign } })

    expect(await purgeExpiredTrash(db, { nowMs, sourceId: site.sourceId })).toEqual({
      purged: 2,
      failed: 0,
    })

    const left = await db.card.findMany({
      where: { sourceId: site.sourceId },
      select: { id: true },
    })
    expect(left.map((c) => c.id).sort()).toEqual([ids.fresh, ids.kept].sort())
    const key = (c: typeof expired) => ({ sourceId: site.sourceId, scheibenId: c.scheibenId! })
    expect(
      await db.deleteLock.findFirst({ where: { ...key(expired), userId: site.ownerId } })
    ).not.toBeNull()
    expect(
      await db.deleteLock.findFirst({ where: { ...key(foreign), userId: other } })
    ).not.toBeNull()
    expect(await isKeyBlocked(db, key(expired), expired.startedAt.getTime())).toBe(true)
    // ein zweiter Lauf findet nichts mehr
    expect(await purgeExpiredTrash(db, { nowMs, sourceId: site.sourceId })).toEqual({
      purged: 0,
      failed: 0,
    })
  })
})
