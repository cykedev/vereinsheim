import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "../db/cards"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { getUsers } = await import("./queries")

const DAY_MS = 86_400_000
const NOW = Date.UTC(2026, 9, 14, 12)
let site: TestSite
const ids = {
  quiet: "",
  fresh: "",
  none: "",
  inactive: "",
  waitingOnly: "",
  trashedOnly: "",
  lockedOnly: "",
  rejectedOnly: "",
}

beforeAll(async () => {
  site = await createTestSite(db, "users-counts")
  const user = (label: string) =>
    db.user
      .create({ data: { email: `${label}-${site.siteId}@example.com`, passwordHash: "-" } })
      .then((u) => u.id)
  ids.quiet = await user("quiet")
  ids.fresh = await user("fresh")
  ids.none = await user("none")
  ids.inactive = await user("inactive")
  await db.user.update({ where: { id: ids.inactive }, data: { isActive: false } })
  ids.waitingOnly = await user("waiting-only")
  ids.trashedOnly = await user("trashed-only")
  ids.lockedOnly = await user("locked-only")
  ids.rejectedOnly = await user("rejected-only")
  // vier Scheiben des Besitzers: zwei sichtbar, eine gelöscht, eine wartend
  const inputs = generateSeason({
    seed: 41,
    cards: 4,
    firstMs: Date.UTC(2026, 9, 1, 17),
    everyDays: 3,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 7600,
  })
  const written = []
  for (const [i, input] of inputs.entries())
    written.push(
      await writeRevision(db, {
        ...input,
        card: { ...input.card, ownerPending: i === 3 },
      })
    )
  await db.card.update({ where: { id: written[2].cardId }, data: { deletedAt: new Date() } })
  // Zustimmungen: lange bestätigt ohne Scheibe (Hinweis), frisch bestätigt ohne Scheibe (noch kein Hinweis)
  const consent = (userId: string, sportpassId: number, confirmedDaysAgo: number) =>
    db.sportpassConsent.create({
      data: {
        userId,
        siteId: site.siteId,
        sportpassId: BigInt(sportpassId),
        confirmedAt: new Date(NOW - confirmedDaysAgo * DAY_MS),
      },
    })
  await consent(ids.quiet, 76001, 20)
  await consent(ids.fresh, 76002, 3)
  await consent(site.ownerId, 76003, 20)
  // lange bestätigt, aber kein Grund für den Hinweis: deaktiviert, nur wartende, nur gelöschte,
  // nur endgültig gelöschte
  await consent(ids.inactive, 76004, 20)
  await consent(ids.waitingOnly, 76005, 20)
  await consent(ids.trashedOnly, 76006, 20)
  await consent(ids.lockedOnly, 76007, 20)
  await consent(ids.rejectedOnly, 76008, 20)
  const more = generateSeason({
    seed: 42,
    cards: 2,
    firstMs: Date.UTC(2026, 9, 2, 17),
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: ids.waitingOnly,
    scheibenIdBase: 7700,
  })
  await writeRevision(db, { ...more[0], card: { ...more[0].card, ownerPending: true } })
  const trashed = await writeRevision(db, {
    ...more[1],
    card: { ...more[1].card, ownerId: ids.trashedOnly },
  })
  await db.card.update({ where: { id: trashed.cardId }, data: { deletedAt: new Date() } })
  await db.deleteLock.create({
    data: {
      userId: ids.lockedOnly,
      sourceId: site.sourceId,
      scheibenId: 7799,
      startedAt: new Date(NOW - 5 * DAY_MS),
    },
  })
  await db.tombstone.create({
    data: {
      sourceId: site.sourceId,
      scheibenId: 7798,
      startedAt: new Date(NOW - 5 * DAY_MS),
      reason: "nicht-meine",
      userId: ids.rejectedOnly,
      sportpassId: BigInt(76008),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } })
  await db.$disconnect()
})

describe("Zahlen je Konto", () => {
  it("sichtbare Scheiben, die letzte, Wartende; gelöschte zählen nicht", async () => {
    const users = await getUsers(NOW)
    const owner = users.find((u) => u.id === site.ownerId)!
    const visible = await db.card.findMany({
      where: { ownerId: site.ownerId, deletedAt: null, ownerPending: false },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    })
    expect(visible).toHaveLength(2)
    expect(owner).toMatchObject({
      cards: 2,
      lastCardAt: visible[0].startedAt.toISOString(),
      waiting: 1,
      quiet: false,
    })
  })

  it("Hinweis nur bei aktiver Zustimmung älter als 14 Tage ohne jede Scheibe", async () => {
    const users = await getUsers(NOW)
    const of = (id: string) => users.find((u) => u.id === id)!
    expect(of(ids.quiet)).toMatchObject({ cards: 0, lastCardAt: null, waiting: 0, quiet: true })
    expect(of(ids.fresh).quiet).toBe(false)
    expect(of(ids.none)).toMatchObject({ cards: 0, waiting: 0, quiet: false })
  })

  it("kein Hinweis bei deaktiviertem Konto, nur wartenden, gelöschten oder zurückgewiesenen Scheiben", async () => {
    const users = await getUsers(NOW)
    const of = (id: string) => users.find((u) => u.id === id)!
    expect(of(ids.inactive).quiet).toBe(false)
    expect(of(ids.waitingOnly)).toMatchObject({ cards: 0, waiting: 1, quiet: false })
    expect(of(ids.trashedOnly)).toMatchObject({ cards: 0, waiting: 0, quiet: false })
    expect(of(ids.lockedOnly)).toMatchObject({ cards: 0, waiting: 0, quiet: false })
    expect(of(ids.rejectedOnly)).toMatchObject({ cards: 0, waiting: 0, quiet: false })
  })
})
