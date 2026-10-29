import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import type { ImportedEntry } from "./treffsicher-entry"
import {
  deletePreviewDiary,
  replaceExecutions,
  setImportedLinks,
  upsertImportedEntry,
} from "./write"

const db = createPrismaClient()
let site: TestSite
let otherId: string

beforeAll(async () => {
  site = await createTestSite(db, "diary-transfer-write")
  otherId = (
    await db.user.create({
      data: { email: `diary-transfer-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.diaryEntry.deleteMany({ where: { userId: { in: [site.ownerId, otherId] } } })
  await db.diaryGoal.deleteMany({ where: { userId: { in: [site.ownerId, otherId] } } })
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

const entry = (key: string, over: Partial<ImportedEntry> = {}): ImportedEntry => ({
  importKey: `preview:${key}-${site.siteId}`,
  day: "2026-03-13",
  kind: "shooting",
  familyId: site.familyId,
  intention: "Abzug",
  outcome: "yes",
  learned: null,
  question: null,
  note: "Notiz",
  expectedScore: 360.5,
  scales: [{ part: "wellbeing", aspect: "sleep", value: 73 }],
  ...over,
})

describe("upsertImportedEntry", () => {
  it("legt an und ersetzt beim zweiten Mal Felder und Werte, die Kennung bleibt", async () => {
    const first = await db.$transaction((tx) => upsertImportedEntry(tx, site.ownerId, entry("a")))
    expect(first.created).toBe(true)
    const second = await db.$transaction((tx) =>
      upsertImportedEntry(
        tx,
        site.ownerId,
        entry("a", {
          intention: "Atmung",
          scales: [
            { part: "wellbeing", aspect: "energy", value: 41 },
            { part: "feedback", aspect: "technique", value: 60 },
          ],
        })
      )
    )
    expect(second).toEqual({ id: first.id, created: false })
    const rows = await db.diaryEntry.findMany({
      where: { importKey: entry("a").importKey },
      include: { scales: true },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].intention).toBe("Atmung")
    expect(Number(rows[0].expectedScore)).toBe(360.5)
    expect(rows[0].scales.map((s) => [s.part, s.aspect, s.value]).sort()).toEqual([
      ["feedback", "technique", 60],
      ["wellbeing", "energy", 41],
    ])
  })

  it("ein Schlüssel eines anderen Kontos ist ein Fehler", async () => {
    await expect(
      db.$transaction((tx) => upsertImportedEntry(tx, otherId, entry("a")))
    ).rejects.toThrow()
  })
})

describe("Zeilen und Ausführung", () => {
  it("verknüpft Scheiben und ersetzt die Ausführung", async () => {
    const { id } = await db.$transaction((tx) => upsertImportedEntry(tx, site.ownerId, entry("b")))
    const cardId = `card-${site.siteId}`
    await db.$transaction(async (tx) => {
      await setImportedLinks(tx, id, [cardId])
      await replaceExecutions(tx, id, [
        { cardId, series: 1, value: 10 },
        { cardId, series: 2, value: 90 },
      ])
    })
    await db.$transaction((tx) => replaceExecutions(tx, id, [{ cardId, series: 3, value: 50 }]))
    expect(await db.diaryEntryCard.findMany({ where: { entryId: id } })).toMatchObject([
      { cardId, link: "linked" },
    ])
    expect(
      (await db.diarySeriesExecution.findMany({ where: { entryId: id } })).map((e) => e.series)
    ).toEqual([3])
  })
})

describe("deletePreviewDiary", () => {
  it("löscht nur Zeilen mit `preview:` dieses Kontos", async () => {
    const own = await db.diaryEntry.create({
      data: {
        userId: site.ownerId,
        day: new Date("2026-03-14T00:00:00Z"),
        familyId: site.familyId,
      },
    })
    const imported = await db.diaryEntry.create({
      data: {
        userId: site.ownerId,
        day: new Date("2026-03-14T00:00:00Z"),
        familyId: site.familyId,
        importKey: `treffsicher:keep-${site.siteId}`,
      },
    })
    const foreign = await db.diaryEntry.create({
      data: {
        userId: otherId,
        day: new Date("2026-03-14T00:00:00Z"),
        familyId: site.familyId,
        importKey: `preview:foreign-${site.siteId}`,
      },
    })
    await db.diaryGoal.create({
      data: {
        userId: site.ownerId,
        title: "Ziel",
        kind: "process",
        from: new Date("2026-03-01T00:00:00Z"),
        to: new Date("2026-03-31T00:00:00Z"),
        importKey: `preview:goal-${site.siteId}`,
      },
    })
    const deleted = await db.$transaction((tx) => deletePreviewDiary(tx, site.ownerId))
    expect(deleted).toEqual({ entries: 2, goals: 1, routines: 0 })
    const left = await db.diaryEntry.findMany({
      where: { id: { in: [own.id, imported.id, foreign.id] } },
      select: { id: true },
    })
    expect(left.map((e) => e.id).sort()).toEqual([own.id, imported.id, foreign.id].sort())
    expect(await db.diaryEntry.count({ where: { importKey: entry("a").importKey } })).toBe(0)
  })
})
