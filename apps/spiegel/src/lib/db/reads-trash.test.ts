import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "./cards"
import { blockedCards, ownCardState, ownerCards, trashCards } from "./reads"

const db = createPrismaClient()
const DAY_MS = 86_400_000
let site: TestSite
let other: string
const ids = { kept: "", older: "", newer: "", pending: "", foreign: "" }

beforeAll(async () => {
  site = await createTestSite(db, "reads-trash")
  other = (
    await db.user.create({
      data: { email: `reads-trash-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  const inputs = generateSeason({
    seed: 31,
    cards: 5,
    firstMs: Date.UTC(2026, 4, 1, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 7300,
  })
  const write = async (i: number, card: Record<string, unknown> = {}) =>
    (await writeRevision(db, { ...inputs[i], card: { ...inputs[i].card, ...card } })).cardId
  ids.kept = await write(0)
  ids.older = await write(1)
  ids.newer = await write(2)
  ids.pending = await write(3, { ownerPending: true })
  ids.foreign = await write(4, { ownerId: other })
  const now = Date.now()
  await db.card.update({
    where: { id: ids.older },
    data: { deletedAt: new Date(now - 5 * DAY_MS) },
  })
  await db.card.update({ where: { id: ids.newer }, data: { deletedAt: new Date(now - DAY_MS) } })
  for (const id of [ids.pending, ids.foreign])
    await db.card.update({ where: { id }, data: { deletedAt: new Date(now) } })
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

describe("Papierkorb lesen", () => {
  it("nur eigene gelöschte, zuletzt gelöschte zuerst, mit Ende der 30 Tage; Übersichten zeigen sie nicht", async () => {
    const trash = await trashCards(db, site.ownerId)
    expect(trash.map((t) => t.card.id)).toEqual([ids.newer, ids.older])
    for (const t of trash) expect(t.endsAtMs - t.deletedAtMs).toBe(30 * DAY_MS)
    const shown = (await ownerCards(db, { ownerId: site.ownerId })).map((c) => c.id)
    expect(shown).toEqual([ids.kept])
  })

  it("wo eine eigene Scheibe liegt", async () => {
    const state = (cardId: string) => ownCardState(db, { cardId, ownerId: site.ownerId })
    expect(await state(ids.kept)).toBe("visible")
    expect(await state(ids.older)).toBe("trash")
    expect(await state(ids.pending)).toBeNull()
    expect(await state(ids.foreign)).toBeNull()
  })

  it("was nicht von selbst wiederkommt: eigene Sperren und Meldungen, keine fremden", async () => {
    const start = (days: number) => new Date(Date.UTC(2026, 3, 1) + days * DAY_MS)
    const base = { sourceId: site.sourceId, cycle: 0 }
    await db.deleteLock.create({
      data: { ...base, userId: site.ownerId, scheibenId: 1, startedAt: start(1) },
    })
    await db.tombstone.create({
      data: {
        ...base,
        userId: site.ownerId,
        scheibenId: 2,
        startedAt: start(2),
        reason: "nicht-meine",
      },
    })
    await db.deleteLock.create({
      data: { ...base, userId: other, scheibenId: 3, startedAt: start(3) },
    })
    await db.tombstone.create({
      data: { ...base, userId: other, scheibenId: 4, startedAt: start(4), reason: "nicht-meine" },
    })
    const blocked = await blockedCards(db, site.ownerId)
    expect(blocked.map((b) => [b.kind, b.startedAtMs])).toEqual([
      ["not-mine", start(2).getTime()],
      ["deleted", start(1).getTime()],
    ])
  })
})
