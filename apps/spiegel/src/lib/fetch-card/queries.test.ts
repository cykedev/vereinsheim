import { createHash, randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { dismissRequest, MAX_OPEN_REQUESTS } from "../card-requests/queries"
import { writeRevision } from "../db/cards"
import { kindOfRow } from "../db/reads"
import type { StoredPrintout } from "../printouts/store"

import {
  cardFetchInfo,
  fetchCard,
  legacyRequests,
  newCardChoices,
  type FetchInput,
} from "./queries"

// Holen an einer eigenen Testanlage, mit einem zweiten Konto; je Fall eine eigene ScheibenID. Die Disziplin der Anlage
// ist eingeordnet (bestätigt, mit Familie und Scheibenbild).

const db = createPrismaClient()
let site: TestSite
let other: string
let nextId = 93_000
const RUN = randomUUID()
const DAY_MS = 86_400_000

beforeAll(async () => {
  site = await createTestSite(db, "fetch-card")
  await db.discipline.update({
    where: { id: site.disciplineId },
    data: { confirmedAt: new Date() },
  })
  other = (
    await db.user.create({
      data: { email: `fetch-b-${site.siteId}@example.com`, name: "B", passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.card.deleteMany({ where: { ownerId: other } })
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

const DAY = "2026-10-21"
/** 19:52 Uhr in Berlin am Abend `DAY` */
const PRINTED = new Date("2026-10-21T17:52:12Z")
const file = (scheibenId: number, text = "a", printedAt = PRINTED): StoredPrintout => ({
  sha256: createHash("sha256").update(`${RUN}-${scheibenId}-${text}`).digest("hex"),
  size: 1,
  fileName: "ausdruck.pdf",
  hex: (scheibenId >>> 0).toString(16).padStart(8, "0"),
  scheibenId,
  printedAt,
})
const choice = { disciplineId: 0, kind: "competition" as const }
const input = (scheibenId: number, over: Partial<FetchInput> = {}): FetchInput => ({
  userId: site.ownerId,
  siteId: site.siteId,
  scheibenId,
  day: DAY,
  file: null,
  choice: null,
  ...over,
})
const withChoice = (scheibenId: number, over: Partial<FetchInput> = {}) =>
  input(scheibenId, { choice: { ...choice, disciplineId: site.disciplineId }, ...over })

/** eine Scheibe der Brücke am Abend `DAY` */
async function bridgeCard(scheibenId: number, ownerId = site.ownerId) {
  const [card] = generateSeason({
    seed: scheibenId,
    cards: 1,
    firstMs: Date.UTC(2026, 9, 21, 17, 0),
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId,
    scheibenIdBase: scheibenId,
  })
  return (await writeRevision(db, card)).cardId
}
const requestsOf = (scheibenId: number) =>
  db.cardRequest.findMany({ where: { siteId: site.siteId, scheibenId }, orderBy: { id: "asc" } })
const cardsWithPrintout = (scheibenId: number) =>
  db.card.findMany({
    where: { printouts: { some: { footerId: file(scheibenId).hex } } },
    include: { printouts: true },
  })
const lock = (scheibenId: number, userId: string, startedAt = new Date("2026-10-21T17:00:00Z")) =>
  db.deleteLock.create({
    data: { userId, sourceId: site.sourceId, scheibenId, cycle: 0, startedAt },
  })

describe("fetchCard", () => {
  it("neu ohne Wahl: fragen, nichts geschrieben", async () => {
    const id = nextId++
    expect(await fetchCard(db, input(id, { file: file(id) }))).toEqual({
      kind: "choose",
      relifts: false,
    })
    expect(await cardsWithPrintout(id)).toEqual([])
    expect(await requestsOf(id)).toEqual([])
  })

  it("neu mit PDF und Wahl: Scheibe vom Ausdruck mit Druckzeit, Disziplin, Art, Ausdruck und offenem Auftrag", async () => {
    const id = nextId++
    const result = await fetchCard(db, withChoice(id, { file: file(id) }))
    expect(result).toMatchObject({ kind: "created", relifted: false })
    const [card] = await cardsWithPrintout(id)
    expect(card).toMatchObject({
      id: (result as { cardId: string }).cardId,
      origin: "pdf",
      sourceId: null,
      ownerId: site.ownerId,
      disciplineId: site.disciplineId,
      kind: "competition",
      kindChoice: "competition",
      startedAt: PRINTED,
    })
    expect(card.printouts).toHaveLength(1)
    expect((await requestsOf(id)).map((r) => [r.status, r.cardId, r.day])).toEqual([
      ["open", card.id, DAY],
    ])
  })

  it("getippte ID: 12 Uhr des Tags in der Zone der Anlage, kein Ausdruck, ein Auftrag", async () => {
    const id = nextId++
    const result = await fetchCard(db, withChoice(id))
    if (result.kind !== "created") throw new Error(result.kind)
    const card = await db.card.findUniqueOrThrow({
      where: { id: result.cardId },
      include: { printouts: true },
    })
    expect(card.startedAt).toEqual(new Date("2026-10-21T10:00:00Z"))
    expect(card.printouts).toEqual([])
    expect((await requestsOf(id)).map((r) => r.cardId)).toEqual([card.id])
  })

  it("derselbe Ausdruck noch einmal öffnet, ein zweiter derselben ID hängt an; kein zweiter Auftrag", async () => {
    const id = nextId++
    const created = await fetchCard(db, withChoice(id, { file: file(id) }))
    if (created.kind !== "created") throw new Error(created.kind)
    expect(await fetchCard(db, input(id, { file: file(id) }))).toEqual({
      kind: "opened",
      cardId: created.cardId,
      attached: true,
    })
    expect((await cardsWithPrintout(id))[0].printouts).toHaveLength(1)
    await fetchCard(db, input(id, { file: file(id, "b") }))
    expect((await cardsWithPrintout(id))[0].printouts).toHaveLength(2)
    expect(await requestsOf(id)).toHaveLength(1)
    // die getippte ID derselben Scheibe findet sie über den Auftrag
    expect(await fetchCard(db, input(id))).toMatchObject({ kind: "opened", attached: false })
  })

  it("eigene Scheibe der Brücke: öffnet, der Ausdruck hängt an, kein Auftrag", async () => {
    const id = nextId++
    const cardId = await bridgeCard(id)
    expect(await fetchCard(db, input(id, { file: file(id) }))).toEqual({
      kind: "opened",
      cardId,
      attached: true,
    })
    expect(await db.printout.count({ where: { cardId } })).toBe(1)
    expect(await requestsOf(id)).toEqual([])
  })

  it("im Papierkorb: zurück; nach 30 Tagen nicht mehr", async () => {
    const id = nextId++
    const cardId = await bridgeCard(id)
    await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
    expect(await fetchCard(db, input(id))).toEqual({ kind: "restored", cardId })
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).deletedAt).toBeNull()

    await db.card.update({
      where: { id: cardId },
      data: { deletedAt: new Date(Date.now() - 31 * DAY_MS) },
    })
    expect(await fetchCard(db, input(id))).toEqual({ kind: "trashExpired" })
  })

  it("wartend in „Offen“: pending", async () => {
    const id = nextId++
    const cardId = await bridgeCard(id)
    await db.card.update({ where: { id: cardId }, data: { ownerPending: true } })
    expect(await fetchCard(db, input(id, { file: file(id) }))).toEqual({ kind: "pending" })
  })

  it("fremde Scheibe des Abends: vergeben, nichts geschrieben", async () => {
    const id = nextId++
    await bridgeCard(id, other)
    expect(await fetchCard(db, withChoice(id, { file: file(id) }))).toEqual({ kind: "taken" })
    expect(
      await db.printout.count({
        where: { footerId: file(id).hex, card: { ownerId: site.ownerId } },
      })
    ).toBe(0)
    expect(await requestsOf(id)).toEqual([])
  })

  it("fremde Sperre oder ein Grabstein an diesem Abend: lässt sich nicht holen", async () => {
    const foreign = nextId++
    await lock(foreign, other)
    expect(await fetchCard(db, withChoice(foreign))).toEqual({ kind: "blocked" })
    const tomb = nextId++
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: tomb,
        startedAt: new Date("2026-10-21T17:00:00Z"),
        reason: "nicht-meine",
        userId: site.ownerId,
      },
    })
    expect(await fetchCard(db, withChoice(tomb))).toEqual({ kind: "blocked" })
    // an einem anderen Abend gilt die Sperre nicht
    expect((await fetchCard(db, withChoice(foreign, { day: "2026-10-22" }))).kind).toBe("created")
  })

  it("eigene Sperre: fragen mit Hinweis; mit Wahl ist sie weg; mit fremder daneben bleibt alles", async () => {
    const id = nextId++
    const own = await lock(id, site.ownerId)
    expect(await fetchCard(db, input(id))).toEqual({ kind: "choose", relifts: true })
    expect(await fetchCard(db, withChoice(id))).toMatchObject({ kind: "created", relifted: true })
    expect(await db.deleteLock.count({ where: { id: own.id } })).toBe(0)

    const both = nextId++
    const mine = await lock(both, site.ownerId)
    await lock(both, other)
    expect(await fetchCard(db, withChoice(both))).toEqual({ kind: "blocked" })
    expect(await db.deleteLock.count({ where: { id: mine.id } })).toBe(1)
  })

  it("zehn ungefüllte offene Aufträge: keine weitere Scheibe; gefüllte zählen nicht", async () => {
    const user = (
      await db.user.create({
        data: { email: `fetch-c-${site.siteId}@example.com`, name: "C", passwordHash: "-" },
      })
    ).id
    try {
      const filled = await bridgeCard(nextId++, user)
      await db.cardRequest.create({
        data: { userId: user, siteId: site.siteId, scheibenId: 1, day: DAY, cardId: filled },
      })
      // der gefüllte zählt nicht: zehn neue gehen
      for (let i = 0; i < MAX_OPEN_REQUESTS; i++)
        expect((await fetchCard(db, withChoice(nextId++, { userId: user }))).kind).toBe("created")
      expect(await fetchCard(db, withChoice(nextId++, { userId: user }))).toEqual({
        kind: "tooMany",
      })
    } finally {
      await db.card.deleteMany({ where: { ownerId: user } })
      await db.user.delete({ where: { id: user } })
    }
  })

  it("ein älterer offener Auftrag ohne Scheibe bekommt die neue, kein zweiter", async () => {
    const id = nextId++
    const legacy = await db.cardRequest.create({
      data: { userId: site.ownerId, siteId: site.siteId, scheibenId: id, day: DAY },
    })
    expect(await legacyRequests(db, site.ownerId)).toContainEqual({
      id: legacy.id,
      hex: file(id).hex,
      day: DAY,
    })
    const result = await fetchCard(db, withChoice(id))
    if (result.kind !== "created") throw new Error(result.kind)
    expect((await requestsOf(id)).map((r) => [r.id, r.cardId])).toEqual([
      [legacy.id, result.cardId],
    ])
    expect((await legacyRequests(db, site.ownerId)).map((r) => r.id)).not.toContain(legacy.id)
  })

  it("nach „Nicht mehr holen“: Holen öffnet die Scheibe mit neuem offenem Auftrag", async () => {
    const id = nextId++
    const created = await fetchCard(db, withChoice(id))
    if (created.kind !== "created") throw new Error(created.kind)
    const [first] = await requestsOf(id)
    expect(await dismissRequest(db, { userId: site.ownerId, requestId: first.id })).toBe(true)
    expect(await fetchCard(db, input(id))).toMatchObject({ kind: "opened", cardId: created.cardId })
    expect((await requestsOf(id)).map((r) => r.status)).toEqual(["withdrawn", "open"])
  })

  it("ignorierte, fremde oder familienlose Disziplin: steht nicht zur Wahl", async () => {
    const foreignSite = await createTestSite(db, "fetch-card-foreign")
    try {
      const loose = await db.discipline.create({
        data: {
          siteId: site.siteId,
          meytonId: 1,
          name: "ohne Familie",
          targetId: "lp-10m",
          confirmedAt: new Date(),
        },
      })
      const ignored = await db.discipline.create({
        data: {
          siteId: site.siteId,
          meytonId: 2,
          name: "ignoriert",
          targetId: "lp-10m",
          familyId: site.familyId,
          confirmedAt: new Date(),
          ignoredAt: new Date(),
        },
      })
      for (const disciplineId of [loose.id, ignored.id, foreignSite.disciplineId])
        expect(
          await fetchCard(db, input(nextId++, { choice: { disciplineId, kind: "training" } }))
        ).toEqual({ kind: "notAllowed" })
    } finally {
      await db.discipline.deleteMany({ where: { siteId: site.siteId, meytonId: { in: [1, 2] } } })
      await foreignSite.remove()
    }
  })

  it("zweimal gleichzeitig derselbe Ausdruck mit Wahl: eine Scheibe", async () => {
    const id = nextId++
    const results = await Promise.all([
      fetchCard(db, withChoice(id, { file: file(id) })),
      fetchCard(db, withChoice(id, { file: file(id) })),
    ])
    expect(results.map((r) => r.kind).sort()).toEqual(["created", "opened"])
    expect(await cardsWithPrintout(id)).toHaveLength(1)
    expect(await requestsOf(id)).toHaveLength(1)
  })

  it("die gewählte Art bleibt, wenn die Brücke die Scheibe füllt", async () => {
    const id = nextId++
    const created = await fetchCard(db, withChoice(id))
    if (created.kind !== "created") throw new Error(created.kind)
    const [stand] = generateSeason({
      seed: 7,
      cards: 1,
      firstMs: Date.UTC(2026, 9, 21, 17, 0),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: id,
    })
    await writeRevision(db, {
      ...stand,
      cardId: created.cardId,
      card: { ...stand.card, kind: "training" },
    })
    const row = await db.card.findUniqueOrThrow({
      where: { id: created.cardId },
      select: { kind: true, kindChoice: true, sourceId: true, ranking: { select: { kind: true } } },
    })
    expect(row.sourceId).toBe(site.sourceId)
    expect(row.kind).toBe("training")
    expect(kindOfRow(row, false)).toBe("competition")
  })
})

describe("newCardChoices", () => {
  it("Vorbelegung aus der jüngsten sichtbaren Scheibe; eine ignorierte Disziplin nicht", async () => {
    const user = (
      await db.user.create({
        data: { email: `fetch-d-${site.siteId}@example.com`, name: "D", passwordHash: "-" },
      })
    ).id
    try {
      expect(await newCardChoices(db, { userId: user, siteId: site.siteId })).toMatchObject({
        preset: { disciplineId: null, kind: "training" },
      })
      const created = await fetchCard(db, withChoice(nextId++, { userId: user }))
      if (created.kind !== "created") throw new Error(created.kind)
      const choices = await newCardChoices(db, { userId: user, siteId: site.siteId })
      expect(choices.options.map((o) => o.id)).toContain(site.disciplineId)
      expect(choices.preset).toEqual({ disciplineId: site.disciplineId, kind: "competition" })

      const ignored = await db.discipline.create({
        data: {
          siteId: site.siteId,
          meytonId: 3,
          name: "ignoriert",
          targetId: "lp-10m",
          familyId: site.familyId,
          confirmedAt: new Date(),
        },
      })
      await db.card.update({
        where: { id: created.cardId },
        data: { disciplineId: ignored.id },
      })
      await db.discipline.update({ where: { id: ignored.id }, data: { ignoredAt: new Date() } })
      const after = await newCardChoices(db, { userId: user, siteId: site.siteId })
      expect(after.options.map((o) => o.id)).not.toContain(ignored.id)
      expect(after.preset.disciplineId).toBeNull()
    } finally {
      await db.card.deleteMany({ where: { ownerId: user } })
      await db.discipline.deleteMany({ where: { siteId: site.siteId, meytonId: 3 } })
      await db.user.delete({ where: { id: user } })
    }
  })
})

describe("cardFetchInfo", () => {
  it("ID der Brücke, des Ausdrucks oder des Auftrags; zurückgezogen nicht gezeigt; fremd null", async () => {
    const bridge = nextId++
    const bridgeId = await bridgeCard(bridge)
    expect(await cardFetchInfo(db, { cardId: bridgeId, ownerId: site.ownerId })).toEqual({
      hex: file(bridge).hex,
      printouts: [],
      request: null,
    })
    expect(await cardFetchInfo(db, { cardId: bridgeId, ownerId: other })).toBeNull()

    const printed = nextId++
    const viaPdf = await fetchCard(db, withChoice(printed, { file: file(printed) }))
    if (viaPdf.kind !== "created") throw new Error(viaPdf.kind)
    const info = await cardFetchInfo(db, { cardId: viaPdf.cardId, ownerId: site.ownerId })
    expect(info).toMatchObject({
      hex: file(printed).hex,
      printouts: [{ printedAtMs: PRINTED.getTime() }],
      request: { status: "open", filled: false, hex: file(printed).hex, day: DAY },
    })

    const typed = nextId++
    const viaId = await fetchCard(db, withChoice(typed))
    if (viaId.kind !== "created") throw new Error(viaId.kind)
    const typedInfo = await cardFetchInfo(db, { cardId: viaId.cardId, ownerId: site.ownerId })
    expect(typedInfo?.hex).toBe(file(typed).hex)
    await dismissRequest(db, { userId: site.ownerId, requestId: typedInfo!.request!.id })
    expect(await cardFetchInfo(db, { cardId: viaId.cardId, ownerId: site.ownerId })).toEqual({
      hex: file(typed).hex,
      printouts: [],
      request: null,
    })
  })
})
