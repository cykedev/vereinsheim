import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { CardRequestStatus } from "@/generated/prisma/client"
import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writeRevision } from "../db/cards"

import {
  expireRequests,
  MAX_OPEN_REQUESTS,
  ownRequests,
  removeRequest,
  REQUEST_DAYS,
  requestCard,
  withdrawRequest,
} from "./queries"

// Aufträge an einer eigenen Testanlage; die Kaskade über die Anlage räumt sie weg, die Konten löscht der Test selbst.

const db = createPrismaClient()
let site: TestSite
let user: string
let other: string
const DAY = 86_400_000

beforeAll(async () => {
  site = await createTestSite(db, "card-requests")
  user = (
    await db.user.create({
      data: { email: `req-a-${site.siteId}@example.com`, name: "A", passwordHash: "-" },
    })
  ).id
  other = (
    await db.user.create({
      data: { email: `req-b-${site.siteId}@example.com`, name: "B", passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.deleteMany({ where: { id: { in: [user, other] } } })
  await db.$disconnect()
})

describe("requestCard", () => {
  it("legt an; derselbe offene Auftrag nur einmal; höchstens zehn offene", async () => {
    expect(
      await requestCard(db, {
        userId: user,
        siteId: site.siteId,
        scheibenId: 81_001,
        day: "2026-10-21",
      })
    ).toEqual({
      kind: "created",
    })
    expect(
      await requestCard(db, {
        userId: user,
        siteId: site.siteId,
        scheibenId: 81_001,
        day: "2026-10-21",
      })
    ).toEqual({
      kind: "duplicate",
    })
    // ein anderer Abend ist ein anderer Auftrag
    expect(
      (
        await requestCard(db, {
          userId: user,
          siteId: site.siteId,
          scheibenId: 81_001,
          day: "2026-10-20",
        })
      ).kind
    ).toBe("created")
    for (let i = 2; i < MAX_OPEN_REQUESTS; i++)
      expect(
        (
          await requestCard(db, {
            userId: user,
            siteId: site.siteId,
            scheibenId: 81_000 + 10 * i,
            day: "2026-10-21",
          })
        ).kind
      ).toBe("created")
    expect(
      await requestCard(db, {
        userId: user,
        siteId: site.siteId,
        scheibenId: 81_999,
        day: "2026-10-21",
      })
    ).toEqual({
      kind: "tooMany",
    })
    const own = await ownRequests(db, user)
    expect(own).toHaveLength(MAX_OPEN_REQUESTS)
    expect(own.every((r) => r.status === "open" && r.cardId === null)).toBe(true)
    expect(own.find((r) => r.day === "2026-10-20")?.hex).toBe("00013c69")
    await db.cardRequest.deleteMany({ where: { userId: user } })
  })

  it("liegt die Scheibe des Abends schon in Spiegel: beim Schützen der Weg zu ihr, sonst vergeben", async () => {
    const card = generateSeason({
      seed: 3,
      cards: 3,
      firstMs: Date.UTC(2026, 9, 21, 17, 30),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: other,
      scheibenIdBase: 83_000,
    })[0]
    const { cardId } = await writeRevision(db, card)
    try {
      const day = new Date(card.card.startedAtMs).toISOString().slice(0, 10)
      expect(
        await requestCard(db, {
          userId: user,
          siteId: site.siteId,
          scheibenId: card.card.scheibenId!,
          day,
        })
      ).toEqual({ kind: "taken" })
      expect(
        await requestCard(db, {
          userId: other,
          siteId: site.siteId,
          scheibenId: card.card.scheibenId!,
          day,
        })
      ).toEqual({ kind: "exists", cardId, deleted: false })
      // an einem anderen Abend gibt es sie nicht: ein Auftrag
      expect(
        (
          await requestCard(db, {
            userId: user,
            siteId: site.siteId,
            scheibenId: card.card.scheibenId!,
            day: "2020-01-01",
          })
        ).kind
      ).toBe("created")
    } finally {
      await db.cardRequest.deleteMany({ where: { userId: { in: [user, other] } } })
    }
  })

  it("eine Sperre oder ein Grabstein an diesem Abend: kein Auftrag; an einem anderen Abend schon", async () => {
    const at = { sourceId: site.sourceId, startedAt: new Date(Date.UTC(2026, 9, 21, 18)) }
    await db.tombstone.create({ data: { ...at, scheibenId: 84_001, reason: "not-mine" } })
    await db.deleteLock.create({ data: { ...at, scheibenId: 84_002, userId: user } })
    try {
      for (const scheibenId of [84_001, 84_002]) {
        const input = { userId: user, siteId: site.siteId, scheibenId }
        expect(await requestCard(db, { ...input, day: "2026-10-21" })).toEqual({ kind: "blocked" })
        expect((await requestCard(db, { ...input, day: "2026-10-22" })).kind).toBe("created")
      }
    } finally {
      await db.cardRequest.deleteMany({ where: { userId: user } })
    }
  })
})

describe("removeRequest", () => {
  it("nur eigene, beendete Aufträge ohne Scheibe lassen sich entfernen", async () => {
    const make = async (scheibenId: number, status: CardRequestStatus) =>
      (
        await db.cardRequest.create({
          data: { userId: user, siteId: site.siteId, scheibenId, day: "2026-10-21", status },
        })
      ).id
    const missing = await make(82_101, "missing")
    const withdrawn = await make(82_102, "withdrawn")
    const open = await make(82_103, "open")
    const done = await make(82_104, "done")
    try {
      expect(await removeRequest(db, { userId: other, requestId: missing })).toBe(false)
      expect(await removeRequest(db, { userId: user, requestId: missing })).toBe(true)
      expect(await removeRequest(db, { userId: user, requestId: missing })).toBe(false)
      expect(await removeRequest(db, { userId: user, requestId: withdrawn })).toBe(true)
      expect(await removeRequest(db, { userId: user, requestId: open })).toBe(false)
      expect(await removeRequest(db, { userId: user, requestId: done })).toBe(false)
      const left = await db.cardRequest.findMany({
        where: { userId: user },
        orderBy: { id: "asc" },
        select: { id: true },
      })
      expect(left.map((row) => row.id)).toEqual([open, done])
    } finally {
      await db.cardRequest.deleteMany({ where: { userId: user } })
    }
  })
})

describe("withdrawRequest und Frist", () => {
  it("nur eigene, offene Aufträge lassen sich zurückziehen", async () => {
    await requestCard(db, {
      userId: user,
      siteId: site.siteId,
      scheibenId: 82_001,
      day: "2026-10-21",
    })
    const [own] = await ownRequests(db, user)
    expect(await withdrawRequest(db, { userId: other, requestId: own.id })).toBe(false)
    expect(await withdrawRequest(db, { userId: user, requestId: own.id })).toBe(true)
    expect(await withdrawRequest(db, { userId: user, requestId: own.id })).toBe(false)
    expect((await ownRequests(db, user))[0].status).toBe("withdrawn")
    await db.cardRequest.deleteMany({ where: { userId: user } })
  })

  it("ein Auftrag, der länger als die Frist offen ist: ohne Scheibe ohne Antwort, mit Scheibe erledigt", async () => {
    const now = Date.now()
    await requestCard(db, {
      userId: user,
      siteId: site.siteId,
      scheibenId: 82_002,
      day: "2026-09-01",
      nowMs: now - (REQUEST_DAYS + 1) * DAY,
    })
    expect(await expireRequests(db, now)).toBeGreaterThanOrEqual(1)
    const row = await db.cardRequest.findFirstOrThrow({
      where: { userId: user, scheibenId: 82_002 },
    })
    expect(row.status).toBe("expired")
    expect(await ownRequests(db, user, now)).toEqual([])
    await db.cardRequest.deleteMany({ where: { userId: user } })

    // schon geholt, aber nie endgültig geworden: erledigt
    const card = generateSeason({
      seed: 4,
      cards: 1,
      firstMs: Date.UTC(2026, 8, 1, 17, 30),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: user,
      scheibenIdBase: 85_000,
    })[0]
    const { cardId } = await writeRevision(db, card)
    const fetched = await db.cardRequest.create({
      data: {
        userId: user,
        siteId: site.siteId,
        scheibenId: card.card.scheibenId!,
        day: "2026-09-01",
        cardId,
        createdAt: new Date(now - (REQUEST_DAYS + 1) * DAY),
      },
    })
    await expireRequests(db, now)
    expect((await db.cardRequest.findUniqueOrThrow({ where: { id: fetched.id } })).status).toBe(
      "done"
    )
    await db.cardRequest.deleteMany({ where: { userId: user } })
  })
})
