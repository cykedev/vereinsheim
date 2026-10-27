import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { CardRequestStatus } from "@/generated/prisma/client"
import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writeRevision } from "../db/cards"

import {
  dismissRequest,
  expireRequests,
  finishRequests,
  recordRequestOutcomes,
  REQUEST_DAYS,
} from "./queries"

// Aufträge an einer eigenen Testanlage; die Kaskade über die Anlage räumt sie weg, die Konten löscht der Test selbst.
// „Gefüllt“ heißt: Die Scheibe des Auftrags hat eine Quelle (Rohdaten der Brücke).

const db = createPrismaClient()
let site: TestSite
let user: string
let other: string
const DAY = 86_400_000
let nextId = 81_000

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
afterEach(async () => {
  await db.cardRequest.deleteMany({ where: { userId: { in: [user, other] } } })
})
afterAll(async () => {
  await site.remove()
  await db.user.deleteMany({ where: { id: { in: [user, other] } } })
  await db.$disconnect()
})

/** eine Scheibe vom Ausdruck: ungefüllt und von Anfang an endgültig */
const pdfCard = async () =>
  (
    await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: user,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "pdf",
      },
    })
  ).id

/** eine Scheibe der Brücke (gefüllt), endgültig */
const rawCard = async (seed: number) => {
  const card = generateSeason({
    seed,
    cards: 1,
    firstMs: Date.UTC(2026, 9, 21, 17, 30),
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: user,
    scheibenIdBase: 85_000 + seed * 10,
  })[0]
  const { cardId } = await writeRevision(db, card)
  expect(
    (await db.card.findUniqueOrThrow({ where: { id: cardId }, select: { state: true } })).state
  ).toBe("final")
  return cardId
}

const request = async (
  status: CardRequestStatus,
  cardId: string | null,
  { userId = user, createdAt }: { userId?: string; createdAt?: Date } = {}
) =>
  (
    await db.cardRequest.create({
      data: {
        userId,
        siteId: site.siteId,
        scheibenId: nextId++,
        day: "2026-10-21",
        status,
        cardId,
        ...(createdAt ? { createdAt } : {}),
      },
    })
  ).id

const statusOf = async (id: number) =>
  (await db.cardRequest.findUniqueOrThrow({ where: { id } })).status

describe("Frist", () => {
  it("nach der Frist: ohne Scheibe und ungefüllt ohne Antwort, gefüllt erledigt", async () => {
    const now = Date.now()
    const createdAt = new Date(now - (REQUEST_DAYS + 1) * DAY)
    const without = await request("open", null, { createdAt })
    const unfilled = await request("open", await pdfCard(), { createdAt })
    const filled = await request("open", await rawCard(1), { createdAt })
    const young = await request("open", await pdfCard())
    expect(await expireRequests(db, now)).toBeGreaterThanOrEqual(3)
    expect(await statusOf(without)).toBe("expired")
    expect(await statusOf(unfilled)).toBe("expired")
    expect(await statusOf(filled)).toBe("done")
    expect(await statusOf(young)).toBe("open")
  })
})

describe("finishRequests", () => {
  it("eine ungefüllte, endgültige Scheibe vom Ausdruck bleibt offen, eine gefüllte endgültige ist erledigt", async () => {
    const unfilled = await request("open", await pdfCard())
    const filled = await request("open", await rawCard(2))
    await finishRequests(db, site.siteId)
    expect(await statusOf(unfilled)).toBe("open")
    expect(await statusOf(filled)).toBe("done")
  })
})

describe("recordRequestOutcomes", () => {
  it("„nicht gefunden“ schließt ohne Scheibe und ungefüllt, nicht gefüllt", async () => {
    const without = await request("open", null)
    const unfilled = await request("open", await pdfCard())
    const filled = await request("open", await rawCard(3))
    await recordRequestOutcomes(
      db,
      site.siteId,
      [without, unfilled, filled].map((id) => ({ id, outcome: "missing" as const }))
    )
    expect(await statusOf(without)).toBe("missing")
    expect(await statusOf(unfilled)).toBe("missing")
    expect(await statusOf(filled)).toBe("open")
  })
})

describe("dismissRequest", () => {
  it("offen und beendet ungefüllt: zurückgezogen, die Scheibe bleibt; gefüllt, geholt und fremd nicht", async () => {
    const card = await pdfCard()
    const open = await request("open", card)
    const missing = await request("missing", null)
    const printMismatch = await request("printMismatch", card)
    const filled = await request("open", await rawCard(4))
    const done = await request("done", null)
    const foreign = await request("open", null, { userId: other })

    const dismiss = (requestId: number, userId = user) => dismissRequest(db, { userId, requestId })
    expect(await dismiss(open)).toBe(true)
    expect(await dismiss(open)).toBe(false)
    expect(await dismiss(missing)).toBe(true)
    expect(await dismiss(printMismatch)).toBe(true)
    expect(await dismiss(filled)).toBe(false)
    expect(await dismiss(done)).toBe(false)
    expect(await dismiss(foreign)).toBe(false)
    expect(await dismiss(foreign, other)).toBe(true)

    const rows = await db.cardRequest.findMany({
      where: { id: { in: [open, missing, printMismatch, filled, done] } },
      orderBy: { id: "asc" },
      select: { status: true, cardId: true, closedAt: true },
    })
    expect(rows.map((r) => r.status)).toEqual([
      "withdrawn",
      "withdrawn",
      "withdrawn",
      "open",
      "done",
    ])
    expect(rows[0].cardId).toBe(card)
    expect(rows[0].closedAt).not.toBeNull()
    expect(await db.card.count({ where: { id: card } })).toBe(1)
  })
})
