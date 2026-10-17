import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { frozenCaseIds, frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import type { TargetId } from "@vereinsheim/shot-core/targets"

import { createPrismaClient } from "@/lib/db"
import { generateSeason, type GeneratedCard } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { ingestBatch } from "../ingest/ingest"
import { adaptSnapshot } from "../ingest/meyton-ssmdb2"

import { refreshDisciplineCards, writeRevision } from "./cards"

const db = createPrismaClient()
let site: TestSite
let other: TestSite
let disciplineId: number

beforeAll(async () => {
  site = await createTestSite(db, "cards-discipline")
  other = await createTestSite(db, "cards-discipline-cases")
  // eine eigene Disziplin, damit die Tests ihre Zuordnung ändern können
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_210_040,
        name: "LP 40 Nachrechnen",
        familyId: site.familyId,
        targetId: null,
      },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await other.remove()
  await db.$disconnect()
})

const season = (scheibenIdBase: number) =>
  generateSeason({
    seed: 20261017,
    cards: 12,
    firstMs: Date.UTC(2026, 0, 5, 17, 30),
    everyDays: 3,
    sourceId: site.sourceId,
    disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase,
  })

/** eine Scheibe mit Wertungsschüssen, ohne Fehlschuss; geschrieben, als hätte das Einlesen ohne Scheibenbild gerechnet */
async function written(scheibenIdBase: number, change?: (card: GeneratedCard) => GeneratedCard) {
  const generated = season(scheibenIdBase).find(
    (card) =>
      card.shots.some((shot) => shot.stellung !== 0) &&
      card.shots.every((shot) => shot.flags.length === 0)
  )!
  const input = change ? change(generated) : generated
  const { version } = await db.discipline.findUniqueOrThrow({ where: { id: disciplineId } })
  const result = await writeRevision(db, {
    ...input,
    card: {
      ...input.card,
      flags: [...input.card.flags, "disziplin-unbekannt"],
      disciplineVersion: version,
    },
  })
  return { cardId: result.cardId, revisionId: result.revisionId, input }
}

const setMapping = (data: { targetId?: TargetId | null; plannedShots?: number | null }) =>
  db.discipline.update({
    where: { id: disciplineId },
    data: { ...data, version: { increment: 1 } },
  })

const refresh = () => refreshDisciplineCards(db, { sourceId: site.sourceId })
const cardOf = (id: string) =>
  db.card.findUniqueOrThrow({
    where: { id },
    include: {
      projection: true,
      currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } },
    },
  })

describe("refreshDisciplineCards", () => {
  it("Scheibenbild eingeordnet: `disziplin-unbekannt` weg, Version und Projektion neu, keine neue Revision", async () => {
    await setMapping({ targetId: null, plannedShots: null })
    const { cardId, revisionId } = await written(5_100)
    const before = await cardOf(cardId)
    await setMapping({ targetId: "lp-10m" })
    expect(await refresh()).toBeGreaterThanOrEqual(1)
    const after = await cardOf(cardId)
    const { version } = await db.discipline.findUniqueOrThrow({ where: { id: disciplineId } })
    expect(after.flags).not.toContain("disziplin-unbekannt")
    expect(after.disciplineVersion).toBe(version)
    expect(after.currentRevisionId).toBe(revisionId)
    expect(after.projection!.computedAt.getTime()).toBeGreaterThanOrEqual(
      before.projection!.computedAt.getTime()
    )
    // gleiche Version: nichts mehr zu tun
    expect(await refresh()).toBe(0)
  })

  it("ein Schuss mit falschem Zehntel wird verdächtig, die Projektion auch", async () => {
    await setMapping({ targetId: null, plannedShots: null })
    const { cardId } = await written(5_200, (card) => {
      const i = card.shots.findIndex(
        (shot) => shot.stellung !== 0 && (shot.decimalTenths ?? 0) > 20
      )
      const shots = card.shots.map((shot, j) =>
        j === i ? { ...shot, decimalTenths: (shot.decimalTenths as number) - 15 } : shot
      )
      return { ...card, shots }
    })
    await setMapping({ targetId: "lp-10m" })
    await refresh()
    const after = await cardOf(cardId)
    const flagged = after.currentRevision!.shots.filter((shot) =>
      shot.flags.includes("verdaechtig")
    )
    expect(flagged).toHaveLength(1)
    expect(after.projection!.suspicious).toBe(true)
    expect(after.flags).not.toContain("korrigiert")
  })

  it("Schusszahl des Admins: vollständig und zurück; dauerhafte Merkmale bleiben", async () => {
    await setMapping({ targetId: "lp-10m", plannedShots: null })
    const { cardId, input } = await written(5_300, (card) => ({
      ...card,
      card: { ...card.card, flags: ["korrigiert", "uhr-abweichung"] },
    }))
    const match = input.shots.filter((shot) => shot.stellung !== 0).length
    expect(match).toBeLessThan(40)
    await setMapping({ plannedShots: match })
    await refresh()
    let card = await cardOf(cardId)
    expect(card.flags).not.toContain("unvollstaendig")
    expect(card.complete).toBe(true)
    expect(card.flags).toEqual(expect.arrayContaining(["korrigiert", "uhr-abweichung"]))
    // zurück auf die DisziplinID (40)
    await setMapping({ plannedShots: null })
    await refresh()
    card = await cardOf(cardId)
    expect(card.flags).toContain("unvollstaendig")
    expect(card.complete).toBe(false)
    expect(card.flags).toEqual(expect.arrayContaining(["korrigiert", "uhr-abweichung"]))
  })

  it("ein Stand, der nach dem Lauf noch mit der alten Version kommt, wird beim nächsten Lauf nachgerechnet", async () => {
    await setMapping({ targetId: null, plannedShots: null })
    const { version: old } = await db.discipline.findUniqueOrThrow({ where: { id: disciplineId } })
    const { cardId, input, revisionId } = await written(5_400)
    await setMapping({ targetId: "lp-10m" })
    await refresh()
    // der Stand mit der alten Zuordnung, geschrieben nach dem Lauf
    await writeRevision(db, {
      ...input,
      card: {
        ...input.card,
        flags: [...input.card.flags, "disziplin-unbekannt"],
        disciplineVersion: old,
      },
    })
    expect((await cardOf(cardId)).flags).toContain("disziplin-unbekannt")
    await refresh()
    const card = await cardOf(cardId)
    expect(card.flags).not.toContain("disziplin-unbekannt")
    expect(card.currentRevisionId).toBe(revisionId)
    expect(card.flags).not.toContain("korrigiert")
  })
})

describe("Nachrechnen gleich dem Adapter (alle eingefrorenen Fälle)", () => {
  // SF-23 legt eine neue, unbestätigte Epoche an; danach nähme die Anlage nichts mehr an
  const caseIds = frozenCaseIds().filter((id) => id !== "SF-23")

  /** was die Brücke von einer Scheibe eines Falls schickt: die gesendeten Lesungen */
  function sent(caseId: string, scheibenId: number): SnapshotV1[] {
    const card = frozenExpected(caseId).cards.find((c) => c.scheibenId === scheibenId)!
    const readings = frozenReadings(caseId)
    return card.sentReadings.flatMap((n) =>
      readings.find((r) => r.reading === n)!.snapshots.filter((s) => s.scheibenId === scheibenId)
    )
  }

  it("Version heben ändert weder Merkmale noch Prüfsumme; die Schüsse sind die des Adapters", async () => {
    const bridge = await db.bridge.create({
      data: { siteId: other.siteId, name: "Test", tokenHash: `test-${other.siteId}` },
    })
    await db.sportpassConsent.create({
      data: {
        userId: other.ownerId,
        siteId: other.siteId,
        sportpassId: BigInt(12345678),
        confirmedAt: new Date(),
        firstCardConfirmedAt: new Date(),
      },
    })
    const target = { bridgeId: bridge.id, siteId: other.siteId, timeZone: "Europe/Berlin" }
    const last = new Map<number, SnapshotV1>()
    for (const caseId of caseIds)
      for (const card of frozenExpected(caseId).cards)
        for (const snapshot of sent(caseId, card.scheibenId)) {
          await ingestBatch(db, target, [snapshot], { nowMs: Date.parse(snapshot.observedAt) })
          last.set(snapshot.scheibenId, snapshot)
        }

    const state = async () =>
      (
        await db.card.findMany({
          where: { sourceId: other.sourceId },
          orderBy: { id: "asc" },
          include: {
            discipline: { select: { targetId: true } },
            currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } },
          },
        })
      ).map((card) => ({
        id: card.id,
        scheibenId: card.scheibenId,
        targetId: card.discipline.targetId,
        clockOffsetMs: card.clockOffsetMs,
        flags: [...card.flags].sort(),
        complete: card.complete,
        contentHash: card.currentRevision?.contentHash,
        shots: (card.currentRevision?.shots ?? []).map((shot) => ({
          key: `${shot.stellung}:${shot.treffer}`,
          flags: [...shot.flags].sort(),
        })),
      }))
    const before = await state()
    expect(before.length).toBeGreaterThan(20)

    await db.discipline.updateMany({
      where: { siteId: other.siteId },
      data: { version: { increment: 1 } },
    })
    expect(await refreshDisciplineCards(db, { sourceId: other.sourceId, limit: 1000 })).toBe(
      before.length
    )
    const after = await state()
    expect(after).toEqual(before)

    // die Merkmale je Schuss sind die, die der Adapter aus dem letzten Stand rechnet
    for (const card of after) {
      const snapshot = last.get(card.scheibenId!)
      if (!snapshot) continue
      const result = adaptSnapshot(snapshot, {
        timeZone: "Europe/Berlin",
        targetId: card.targetId as TargetId | null,
        previousLifesign: null,
        previousLifesignAtMs: null,
        previousClockOffsetMs: card.clockOffsetMs,
        siteClockOffsetMs: null,
      })
      if (result.kind !== "card") continue
      const adapted = new Map(
        result.card.shots.map((shot) => [
          `${shot.stellung}:${shot.treffer}`,
          [...shot.flags].sort(),
        ])
      )
      for (const shot of card.shots)
        if (adapted.has(shot.key))
          expect(shot.flags, `${card.scheibenId} ${shot.key}`).toEqual(adapted.get(shot.key))
    }
  })
})
