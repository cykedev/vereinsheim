import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "../db/cards"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { usageOf } = await import("./overview")

const DAY_MS = 86_400_000
const NOW = Date.UTC(2026, 9, 14, 12)
let site: TestSite
let inactive: string

beforeAll(async () => {
  site = await createTestSite(db, "usage")
  inactive = (
    await db.user.create({
      data: {
        email: `usage-inactive-${site.siteId}@example.com`,
        passwordHash: "-",
        isActive: false,
      },
    })
  ).id
  // aktiver Besitzer: sichtbar und frisch, gelöscht, wartend, sichtbar und alt; dazu eine frische des deaktivierten
  // Kontos und eine ohne Besitzer
  const at = (daysAgo: number) => NOW - daysAgo * DAY_MS
  const cards = generateSeason({
    seed: 51,
    cards: 6,
    firstMs: at(80),
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 7800,
  })
  const plan: { daysAgo: number; card: Record<string, unknown>; deleted?: boolean }[] = [
    { daysAgo: 3, card: {} },
    { daysAgo: 4, card: {}, deleted: true },
    { daysAgo: 5, card: { ownerPending: true } },
    { daysAgo: 60, card: {} },
    { daysAgo: 2, card: { ownerId: inactive } },
    { daysAgo: 2, card: { ownerId: null } },
  ]
  for (const [i, step] of plan.entries()) {
    const input = cards[i]
    const shift = at(step.daysAgo) - input.card.startedAtMs
    const written = await writeRevision(db, {
      ...input,
      card: {
        ...input.card,
        ...step.card,
        startedAtMs: input.card.startedAtMs + shift,
        endedAtMs: input.card.endedAtMs === null ? null : input.card.endedAtMs + shift,
      },
      shots: input.shots.map((shot) => ({
        ...shot,
        firedAtMs: shot.firedAtMs === null ? null : shot.firedAtMs + shift,
      })),
    })
    if (step.deleted)
      await db.card.update({ where: { id: written.cardId }, data: { deletedAt: new Date() } })
  }
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: inactive } })
  await db.$disconnect()
})

describe("Nutzung in der Übersicht", () => {
  it("nur sichtbare Scheiben aktiver Konten, frisch nach dem Beginn, Konten mit frischen", async () => {
    expect(await usageOf(NOW, [site.ownerId, inactive])).toEqual({
      cards: 2,
      recentCards: 1,
      recentAccounts: 1,
    })
  })
})
