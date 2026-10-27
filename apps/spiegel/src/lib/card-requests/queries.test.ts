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
  MAX_OPEN_REQUESTS,
  openRequestsOf,
  recordRequestOutcomes,
  REQUEST_DAYS,
  requestWindow,
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
  {
    userId = user,
    createdAt,
    windowAt,
    day = "2026-10-21",
  }: { userId?: string; createdAt?: Date; windowAt?: Date; day?: string } = {}
) =>
  (
    await db.cardRequest.create({
      data: {
        userId,
        siteId: site.siteId,
        scheibenId: nextId++,
        day,
        status,
        cardId,
        ...(createdAt ? { createdAt } : {}),
        ...(windowAt ? { windowAt } : {}),
      },
    })
  ).id

const statusOf = async (id: number) =>
  (await db.cardRequest.findUniqueOrThrow({ where: { id } })).status

describe("Frist", () => {
  it("nach der Frist ab dem ersten Nennen: ohne Scheibe und ungefüllt ohne Antwort, gefüllt erledigt", async () => {
    const now = Date.now()
    const longAgo = new Date(now - (REQUEST_DAYS + 1) * DAY)
    const windowAt = longAgo
    const without = await request("open", null, { createdAt: longAgo, windowAt })
    const unfilled = await request("open", await pdfCard(), { createdAt: longAgo, windowAt })
    const filled = await request("open", await rawCard(1), { createdAt: longAgo, windowAt })
    // vor langem angelegt, erst kürzlich genannt
    const lateWindow = await request("open", await pdfCard(), {
      createdAt: longAgo,
      windowAt: new Date(now - DAY),
    })
    expect(await expireRequests(db, now)).toBeGreaterThanOrEqual(3)
    expect(await statusOf(without)).toBe("expired")
    expect(await statusOf(unfilled)).toBe("expired")
    expect(await statusOf(filled)).toBe("done")
    expect(await statusOf(lateWindow)).toBe("open")
  })

  it("noch nie genannt: läuft nicht ab, auch lange nach dem Anlegen", async () => {
    const now = Date.now()
    const createdAt = new Date(now - 3 * REQUEST_DAYS * DAY)
    const without = await request("open", null, { createdAt })
    const unfilled = await request("open", await pdfCard(), { createdAt })
    await expireRequests(db, now)
    expect(await statusOf(without)).toBe("open")
    expect(await statusOf(unfilled)).toBe("open")
  })
})

describe("requestWindow", () => {
  const row = (id: number, userId: string, filled = false) => ({ id, userId, filled })

  it("je Konto die ersten ungefüllten und alle gefüllten, in der Folge, wie sie kommt", () => {
    const a = Array.from({ length: MAX_OPEN_REQUESTS + 2 }, (_, i) => row(i + 1, "a"))
    const rows = [
      ...a.slice(0, 5),
      row(100, "a", true),
      row(200, "b"),
      ...a.slice(5),
      row(201, "b"),
    ]
    expect(requestWindow(rows).map((r) => r.id)).toEqual([
      1, 2, 3, 4, 5, 100, 200, 6, 7, 8, 9, 10, 201,
    ])
  })

  it("endet einer, rückt der nächste nach", () => {
    const a = Array.from({ length: MAX_OPEN_REQUESTS + 2 }, (_, i) => row(i + 1, "a"))
    expect(requestWindow(a.slice(1)).map((r) => r.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it("ohne Platz nur die gefüllten", () => {
    expect(requestWindow([row(1, "a"), row(2, "a", true)], 0).map((r) => r.id)).toEqual([2])
  })
})

describe("openRequestsOf", () => {
  it("je Konto zehn ungefüllte der jüngsten Abende, gefüllte dazu; nur die genannten bekommen `windowAt`", async () => {
    const now = Date.now()
    // zuerst angelegt ein heutiger Abend, danach zwölf alte (ein Upload alter Ausdrucke), ein gefüllter und einer eines
    // anderen Kontos: Es zählt der Abend, nicht die Folge des Anlegens
    const today = await request("open", await pdfCard(), { day: "2026-10-27" })
    const old: number[] = []
    for (let i = 0; i < MAX_OPEN_REQUESTS + 2; i++)
      old.push(await request("open", null, { day: `2025-01-${String(i + 10).padStart(2, "0")}` }))
    const filled = await request("open", await rawCard(5), { day: "2024-05-01" })
    const foreign = await request("open", null, { userId: other, day: "2024-05-01" })
    const named = new Date(now - DAY)
    await db.cardRequest.update({ where: { id: old[11] }, data: { windowAt: named } })

    const ids = (await openRequestsOf(db, site.siteId, { nowMs: now })).map((r) => r.id)
    // der heutige zuerst, dann die neun jüngsten alten Abende; die zwei ältesten warten
    expect(ids.filter((id) => old.includes(id) || id === today)).toEqual([
      today,
      ...old.slice(3).reverse(),
    ])
    expect(ids).toContain(filled)
    expect(ids).toContain(foreign)
    expect(ids).not.toContain(old[0])
    expect(ids).not.toContain(old[1])

    const windowAt = async (id: number) =>
      (await db.cardRequest.findUniqueOrThrow({ where: { id }, select: { windowAt: true } }))
        .windowAt
    expect(await windowAt(today)).toEqual(new Date(now))
    expect(await windowAt(filled)).toEqual(new Date(now))
    expect(await windowAt(old[11])).toEqual(named)
    expect(await windowAt(old[0])).toBeNull()

    // endet der heutige, rückt der nächstältere Abend nach
    await db.cardRequest.update({ where: { id: today }, data: { status: "done" } })
    const next = (await openRequestsOf(db, site.siteId, { nowMs: now + 1 })).map((r) => r.id)
    expect(next).toContain(old[2])
    expect(next).not.toContain(old[1])
    expect(await windowAt(old[2])).toEqual(new Date(now + 1))
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
