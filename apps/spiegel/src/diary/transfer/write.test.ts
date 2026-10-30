import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import type { ImportedEntry } from "./treffsicher-entry"
import type { ImportedGoal, ImportedRoutine } from "./treffsicher-goal"
import {
  isTouched,
  releaseImportedLinks,
  replaceExecutions,
  setImportedLinks,
  upsertImportedEntry,
  upsertImportedGoal,
  upsertImportedRoutine,
} from "./write"

const db = createPrismaClient()
/** die Zeit des Laufs, mit der die Übernahme schreibt */
const AT = new Date("2026-10-30T06:00:00.000Z")
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
  await db.diaryRoutine.deleteMany({ where: { userId: { in: [site.ownerId, otherId] } } })
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

const entry = (key: string, over: Partial<ImportedEntry> = {}): ImportedEntry => ({
  importKey: `treffsicher:test-${key}-${site.siteId}`,
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
    const first = await db.$transaction((tx) =>
      upsertImportedEntry(tx, site.ownerId, entry("a"), AT)
    )
    expect(first.created).toBe(true)
    // `updatedAt` ist die Zeit des Laufs, daran erkennt der nächste Lauf den Eintrag als unverändert
    expect((await db.diaryEntry.findUniqueOrThrow({ where: { id: first.id } })).updatedAt).toEqual(
      AT
    )
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
        }),
        AT
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
      db.$transaction((tx) => upsertImportedEntry(tx, otherId, entry("a"), AT))
    ).rejects.toThrow()
  })
})

const goal = (over: Partial<ImportedGoal> = {}): ImportedGoal => ({
  importKey: `treffsicher:goal-${site.siteId}`,
  familyId: site.familyId,
  title: "380 Ringe",
  note: "ruhig",
  kind: "result",
  from: "2026-09-01",
  to: "2026-09-30",
  ...over,
})

describe("upsertImportedGoal", () => {
  it("legt an und setzt beim zweiten Mal die Felder; Messung und Antwort bleiben", async () => {
    const first = await db.$transaction((tx) => upsertImportedGoal(tx, site.ownerId, goal(), AT))
    expect(first.created).toBe(true)
    await db.diaryGoal.update({ where: { id: first.id }, data: { outcome: "partly" } })
    const second = await db.$transaction((tx) =>
      upsertImportedGoal(tx, site.ownerId, goal({ title: "385 Ringe", familyId: null }), AT)
    )
    expect(second).toEqual({ id: first.id, created: false })
    const row = await db.diaryGoal.findUniqueOrThrow({ where: { id: first.id } })
    expect(row).toMatchObject({
      title: "385 Ringe",
      familyId: null,
      note: "ruhig",
      kind: "result",
      outcome: "partly",
      measure: null,
    })
    expect(row.from.toISOString().slice(0, 10)).toBe("2026-09-01")
    expect(row.to.toISOString().slice(0, 10)).toBe("2026-09-30")
  })

  it("ein Schlüssel eines anderen Kontos ist ein Fehler", async () => {
    await expect(
      db.$transaction((tx) => upsertImportedGoal(tx, otherId, goal(), AT))
    ).rejects.toThrow()
  })
})

describe("upsertImportedRoutine", () => {
  const routine = (over: Partial<ImportedRoutine> = {}): ImportedRoutine => ({
    importKey: `treffsicher:routine-${site.siteId}`,
    familyId: null,
    name: "Vor dem Schuss",
    steps: [{ title: "Atmen", description: "tief" }, { title: "Zielen" }],
    ...over,
  })

  it("legt an und ersetzt beim zweiten Mal Name, Familie und Schritte", async () => {
    const first = await db.$transaction((tx) =>
      upsertImportedRoutine(tx, site.ownerId, routine(), AT)
    )
    expect(first.created).toBe(true)
    const second = await db.$transaction((tx) =>
      upsertImportedRoutine(
        tx,
        site.ownerId,
        routine({ familyId: site.familyId, steps: [{ title: "Abziehen" }] }),
        AT
      )
    )
    expect(second).toEqual({ id: first.id, created: false })
    expect(await db.diaryRoutine.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      familyId: site.familyId,
      name: "Vor dem Schuss",
      steps: [{ title: "Abziehen" }],
    })
  })

  it("ein Schlüssel eines anderen Kontos ist ein Fehler", async () => {
    await expect(
      db.$transaction((tx) => upsertImportedRoutine(tx, otherId, routine(), AT))
    ).rejects.toThrow()
  })
})

describe("isTouched", () => {
  const at = new Date("2026-10-29T20:00:00.123Z")
  const row = (updatedAt: Date, deletedAt: Date | null = null) => ({ updatedAt, deletedAt })

  it("vom letzten Lauf geschrieben: `updatedAt` genau die Zeit seines Merkmals, unverändert", () => {
    expect(isTouched(row(new Date(at)), at)).toBe(false)
  })

  it("danach geändert, auch eine Millisekunde, oder im Papierkorb", () => {
    expect(isTouched(row(new Date("2026-10-29T20:00:00.124Z")), at)).toBe(true)
    expect(isTouched(row(new Date(at), at), at)).toBe(true)
  })

  it("älter als der letzte Lauf: ein früherer Lauf ließ die Zeile stehen, sie bleibt", () => {
    expect(isTouched(row(new Date("2026-10-29T20:00:00.122Z")), at)).toBe(true)
    expect(isTouched(row(new Date("2026-10-28T20:00:00Z")), at)).toBe(true)
  })

  it("beim ersten Lauf zählt nur der Papierkorb", () => {
    expect(isTouched(row(new Date("2030-01-01T00:00:00Z")), null)).toBe(false)
    expect(isTouched(row(new Date("2020-01-01T00:00:00Z"), at), null)).toBe(true)
  })
})

describe("Zeilen und Ausführung", () => {
  it("verknüpft Scheiben und ersetzt die Ausführung", async () => {
    const { id } = await db.$transaction((tx) =>
      upsertImportedEntry(tx, site.ownerId, entry("b"), AT)
    )
    const cardId = `card-${site.siteId}`
    await db.$transaction(async (tx) => {
      await setImportedLinks(tx, id, [cardId], AT)
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
    await db.$transaction((tx) => releaseImportedLinks(tx, [cardId]))
    expect(await db.diaryEntryCard.count({ where: { entryId: id } })).toBe(0)
  })
})
