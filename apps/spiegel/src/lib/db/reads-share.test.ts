import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "./cards"
import { cardWithShots, ownCardShare, sharedCard } from "./reads"

const db = createPrismaClient()
let site: TestSite
let other: string
const ids = { shared: "", unshared: "", deleted: "", pending: "", foreign: "" }
const links = { shared: "", deleted: "", pending: "", foreign: "" }

beforeAll(async () => {
  site = await createTestSite(db, "reads-share")
  other = (
    await db.user.create({
      data: { email: `reads-share-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  const inputs = generateSeason({
    seed: 47,
    cards: 5,
    firstMs: Date.UTC(2026, 4, 1, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 7700,
  })
  const write = async (i: number, card: Record<string, unknown> = {}) =>
    (await writeRevision(db, { ...inputs[i], card: { ...inputs[i].card, ...card } })).cardId
  ids.shared = await write(0)
  ids.unshared = await write(1)
  ids.deleted = await write(2)
  ids.pending = await write(3, { ownerPending: true })
  ids.foreign = await write(4, { ownerId: other })
  for (const key of ["shared", "deleted", "pending", "foreign"] as const) {
    links[key] = crypto.randomUUID()
    await db.card.update({
      where: { id: ids[key] },
      data: { shareId: links[key], sharedAt: new Date(Date.UTC(2026, 9, 20, 12)) },
    })
  }
  await db.card.update({ where: { id: ids.deleted }, data: { deletedAt: new Date() } })
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

describe("sharedCard", () => {
  it("liest die geteilte Scheibe mit Schüssen, genau wie die Seite einer Scheibe, ohne Angaben zum Besitzer", async () => {
    const shared = await sharedCard(db, links.shared)
    const own = await cardWithShots(db, { cardId: ids.shared, ownerId: site.ownerId })
    expect(shared).not.toBeNull()
    expect(shared).toEqual(own)
    expect(shared!.shots.length).toBeGreaterThan(0)
    expect(Object.keys(shared!)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/owner|sportpass|share/i)])
    )
  })

  it("nichts für eine unbekannte UUID, eine gelöschte und eine wartende Scheibe", async () => {
    expect(await sharedCard(db, crypto.randomUUID())).toBeNull()
    expect(await sharedCard(db, links.deleted)).toBeNull()
    expect(await sharedCard(db, links.pending)).toBeNull()
  })

  it("auch die Scheibe eines anderen Kontos über ihren Link: Der Link gilt, nicht die Sitzung", async () => {
    expect((await sharedCard(db, links.foreign))?.id).toBe(ids.foreign)
  })

  it("nichts, solange die Disziplin ignoriert ist", async () => {
    await db.discipline.update({
      where: { id: site.disciplineId },
      data: { ignoredAt: new Date() },
    })
    try {
      expect(await sharedCard(db, links.shared)).toBeNull()
    } finally {
      await db.discipline.update({ where: { id: site.disciplineId }, data: { ignoredAt: null } })
    }
    expect(await sharedCard(db, links.shared)).not.toBeNull()
  })

  it("nichts, solange das Konto deaktiviert ist", async () => {
    await db.user.update({ where: { id: site.ownerId }, data: { isActive: false } })
    try {
      expect(await sharedCard(db, links.shared)).toBeNull()
    } finally {
      await db.user.update({ where: { id: site.ownerId }, data: { isActive: true } })
    }
    expect(await sharedCard(db, links.shared)).not.toBeNull()
  })
})

describe("ownCardShare", () => {
  it("der Link einer eigenen Scheibe mit Tag des Teilens; nichts für ungeteilte und fremde", async () => {
    expect(await ownCardShare(db, { cardId: ids.shared, ownerId: site.ownerId })).toEqual({
      shareId: links.shared,
      sharedAtMs: Date.UTC(2026, 9, 20, 12),
    })
    expect(await ownCardShare(db, { cardId: ids.unshared, ownerId: site.ownerId })).toBeNull()
    expect(await ownCardShare(db, { cardId: ids.foreign, ownerId: site.ownerId })).toBeNull()
  })
})
