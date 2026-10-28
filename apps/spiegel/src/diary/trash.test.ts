import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { formatIsoDate } from "@vereinsheim/lib/format"

import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../test/fixtures"

import { createFromEvening, createWithout } from "./entries"
import { diaryList, entryForCard, newEntryView, threadView } from "./queries"
import { ERRORS } from "./texts"
import {
  deleteEntry,
  diaryTrash,
  purgeEntryNow,
  purgeExpiredDiaryTrash,
  restoreEntry,
  TRASH_ERRORS,
} from "./trash"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
const DAY_MS = 86_400_000
let site: TestSite
let disciplineId: number

beforeAll(async () => {
  site = await createTestSite(db, "diary-trash")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 20 Papierkorb",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        seriesShots: 10,
        confirmedAt: new Date(),
      },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const dayAgo = (n: number) => formatIsoDate(new Date(Date.now() - n * DAY_MS), ZONE)

async function entryWithCard(daysAgo: number) {
  const day = dayAgo(daysAgo)
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.parse(`${day}T17:00:00Z`),
    kind: "training",
    details: { total: { shots: 20, rings: 180 } },
    reason: "eingetragen",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  const created = await createFromEvening(db, site.ownerId, {
    day,
    familyId: site.familyId,
    timeZone: ZONE,
  })
  return { id: (created as { id: string }).id, cardId: saved.cardId, day }
}

describe("Papierkorb der Einträge", () => {
  it("löscht, steht nirgends mehr, gibt die Scheibe frei und bekommt sie beim Wiederherstellen zurück", async () => {
    const { id, cardId } = await entryWithCard(2)
    await db.diaryEntry.update({ where: { id }, data: { question: "ruhig zu bleiben?" } })
    expect(await deleteEntry(db, site.ownerId, id)).toBeNull()
    expect(await deleteEntry(db, site.ownerId, id)).toBe(ERRORS.missing)
    expect((await diaryList(db, site.ownerId, ZONE)).some((e) => e.id === id)).toBe(false)
    expect(await entryForCard(db, site.ownerId, cardId, ZONE)).toBeNull()
    expect((await threadView(db, site.ownerId, null)).items.some((i) => i.entryId === id)).toBe(
      false
    )
    // die Zeile bleibt für das Wiederherstellen, hält die Scheibe aber nicht
    expect(await db.diaryEntryCard.count({ where: { entryId: id, link: "linked" } })).toBe(1)
    expect(await db.card.count({ where: { id: cardId } })).toBe(1)
    expect(
      (await newEntryView(db, site.ownerId, ZONE, cardId)).proposals.some((p) => p.marked)
    ).toBe(true)
    const items = await diaryTrash(db, site.ownerId, ZONE)
    expect(items.find((i) => i.entryId === id)).toMatchObject({ left: "noch 30 Tage" })
    expect(items.find((i) => i.entryId === id)?.facts).toMatch(/1 Scheibe$/)
    expect(await restoreEntry(db, site.ownerId, id, ZONE)).toBeNull()
    expect(await restoreEntry(db, site.ownerId, id, ZONE)).toBe(TRASH_ERRORS.notInTrash)
    expect(await entryForCard(db, site.ownerId, cardId, ZONE)).toMatchObject({ entryId: id })
  })

  it("eine Scheibe, die inzwischen in einem anderen Eintrag steckt, bleibt dort", async () => {
    const { id, cardId, day } = await entryWithCard(4)
    expect(await deleteEntry(db, site.ownerId, id)).toBeNull()
    // ein neuer Eintrag des Abends trägt die freie Scheibe von selbst
    const other = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    expect(await entryForCard(db, site.ownerId, cardId, ZONE)).toMatchObject({ entryId: other.id })
    expect(await restoreEntry(db, site.ownerId, id, ZONE)).toBeNull()
    expect(await entryForCard(db, site.ownerId, cardId, ZONE)).toMatchObject({ entryId: other.id })
    expect(await db.diaryEntryCard.findUnique({ where: { cardId } })).toMatchObject({
      entryId: other.id,
      link: "linked",
    })
    // liegt der andere im Papierkorb, kommt sie wieder in den zurückgekehrten
    expect(await deleteEntry(db, site.ownerId, other.id)).toBeNull()
    expect(await entryForCard(db, site.ownerId, cardId, ZONE)).toMatchObject({ entryId: id })
  })

  it("endgültig nur aus dem Papierkorb; Verknüpfungen gehen mit, die Scheibe bleibt", async () => {
    const { id, cardId } = await entryWithCard(3)
    expect(await purgeEntryNow(db, site.ownerId, id)).toBe(TRASH_ERRORS.notInTrash)
    await deleteEntry(db, site.ownerId, id)
    expect(await purgeEntryNow(db, site.ownerId, id)).toBeNull()
    expect(await db.diaryEntry.count({ where: { id } })).toBe(0)
    expect(await db.diaryEntryCard.count({ where: { cardId } })).toBe(0)
    expect(await db.card.count({ where: { id: cardId } })).toBe(1)
  })

  it("nach 30 Tagen nicht mehr wiederherstellbar und vom Aufräumen endgültig gelöscht", async () => {
    const created = (await createWithout(db, site.ownerId, {
      day: dayAgo(50),
      kind: "mental",
      familyId: null,
      timeZone: ZONE,
    })) as { id: string }
    await db.diaryEntry.update({
      where: { id: created.id },
      data: { deletedAt: new Date(Date.now() - 31 * DAY_MS) },
    })
    expect(await restoreEntry(db, site.ownerId, created.id, ZONE)).toBe(TRASH_ERRORS.expired)
    expect(await purgeExpiredDiaryTrash(db, { nowMs: Date.now() })).toBeGreaterThanOrEqual(1)
    expect(await db.diaryEntry.count({ where: { id: created.id } })).toBe(0)
  })
})
