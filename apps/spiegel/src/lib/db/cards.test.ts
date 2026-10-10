import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cardProjection, projectionVersion } from "@vereinsheim/shot-core/projection"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import {
  appendedShots,
  refreshProjections,
  setDisciplineFamily,
  toMetricShot,
  writeRevision,
} from "./cards"
import { cardWithShots } from "./reads"

const db = createPrismaClient()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "cards")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const season = (cards: number, scheibenIdBase: number) =>
  generateSeason({
    seed: 20261010,
    cards,
    firstMs: Date.UTC(2026, 0, 5, 17, 30),
    everyDays: 3,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase,
  })

async function projectionOf(cardId: string) {
  return db.cardProjection.findUniqueOrThrow({ where: { cardId } })
}

describe("writeRevision", () => {
  it("schreibt Schüsse und Projektion, die Seite der Scheibe liest dieselben Schüsse", async () => {
    const [input] = season(1, 1000)
    const result = await writeRevision(db, input)
    expect(result).toMatchObject({ number: 1, created: true, appended: 0 })

    const card = await cardWithShots(db, result.cardId)
    expect(card?.shots).toEqual(input.shots.map(toMetricShot))
    expect(card).toMatchObject({ kind: input.card.kind, complete: true, revision: 1 })

    const stored = await projectionOf(result.cardId)
    const expected = cardProjection(card!)
    expect(stored.revisionId).toBe(result.revisionId)
    expect(stored.version).toBe(projectionVersion())
    expect(stored.values).toEqual(expected.values)
    expect(stored.records).toEqual(JSON.parse(JSON.stringify(expected.records)))
    expect(stored.printedShots).toBe(expected.printedShots)
  })

  it("dieselben Schüsse in anderer Folge: keine neue Revision, die Merkmale der Scheibe ändern sich trotzdem", async () => {
    const [input] = season(1, 1100)
    const first = await writeRevision(db, input)
    const again = await writeRevision(db, {
      ...input,
      card: { ...input.card, flags: ["ausgenommen"] },
      shots: [...input.shots].reverse(),
    })
    expect(again).toEqual({ ...first, created: false, appended: 0 })
    expect(await db.cardRevision.count({ where: { cardId: first.cardId } })).toBe(1)
    const card = await db.card.findUniqueOrThrow({ where: { id: first.cardId } })
    expect(card.flags).toEqual(["ausgenommen"])
  })

  it("ein geänderter Schuss ergibt Revision 2; die vorige bleibt, unveränderte Schüsse behalten ihren Fingerabdruck", async () => {
    const [input] = season(1, 1200)
    const first = await writeRevision(db, input)
    const changed = input.shots.map((shot, i) =>
      i === input.shots.length - 1
        ? { ...shot, decimalTenths: 109, ring: 10, innerTen: true }
        : shot
    )
    const second = await writeRevision(db, { ...input, shots: changed, reason: "neu-gewertet" })
    expect(second).toMatchObject({ number: 2, created: true, cardId: first.cardId })

    const card = await db.card.findUniqueOrThrow({ where: { id: first.cardId } })
    expect(card.currentRevisionId).toBe(second.revisionId)
    expect(await db.shot.count({ where: { cardId: first.cardId } })).toBe(2 * input.shots.length)
    const [{ fingerprint }] = await db.shot.findMany({
      where: { revisionId: first.revisionId, seq: 1 },
      select: { fingerprint: true },
    })
    expect(await db.shot.count({ where: { cardId: first.cardId, fingerprint } })).toBe(2)
    expect((await projectionOf(first.cardId)).revisionId).toBe(second.revisionId)
    expect((await cardWithShots(db, first.cardId))?.shots.at(-1)?.decimalTenths).toBe(109)
  })
})

describe("appendedShots", () => {
  const shots = () => season(1, 1600)[0].shots
  it("nur neue Schüsse: genau die neuen", () => {
    const all = shots()
    expect(appendedShots(all.slice(0, 5), all.slice(0, 8))).toEqual(all.slice(5, 8))
  })
  it("ein bisheriger Schuss geändert oder weg, auch wenn neue dazukommen: Korrektur", () => {
    const all = shots()
    const changed = all.slice(0, 8).map((s, i) => (i === 2 ? { ...s, decimalTenths: 0 } : s))
    expect(appendedShots(all.slice(0, 5), changed)).toBeNull()
    const flagged = all.slice(0, 8).map((s, i) => (i === 2 ? { ...s, flags: ["verdaechtig"] } : s))
    expect(appendedShots(all.slice(0, 5), flagged)).toBeNull()
    expect(appendedShots(all.slice(0, 5), [...all.slice(1, 5), ...all.slice(5, 8)])).toBeNull()
  })
  it("gleich viele oder doppelte Schlüssel: keine Ergänzung", () => {
    const all = shots()
    expect(appendedShots(all.slice(0, 5), all.slice(0, 5))).toBeNull()
    expect(appendedShots(all.slice(0, 5), [...all.slice(0, 5), all[0]])).toBeNull()
  })
})

describe("offener Durchgang (SF-03)", () => {
  it("kommen nur Schüsse dazu, wächst die aktuelle Revision; eine Korrektur ergibt eine neue", async () => {
    const [input] = season(1, 1500)
    const total = input.shots.length
    let last
    for (let n = 1; n <= total; n++)
      last = await writeRevision(db, { ...input, shots: input.shots.slice(0, n) })
    expect(last).toMatchObject({ number: 1, created: false, appended: 1 })
    const { cardId } = last!
    expect(await db.cardRevision.count({ where: { cardId } })).toBe(1)
    expect(await db.shot.count({ where: { cardId } })).toBe(total)
    expect((await cardWithShots(db, cardId))?.shots).toEqual(input.shots.map(toMetricShot))
    const projection = await projectionOf(cardId)
    expect(projection.printedShots).toBe(
      cardProjection((await cardWithShots(db, cardId))!).printedShots
    )

    // ein Schuss fällt weg (Meyton nimmt ihn zurück): neue Revision, die vorige bleibt vollständig
    const fewer = await writeRevision(db, { ...input, shots: input.shots.slice(0, total - 1) })
    expect(fewer).toMatchObject({ number: 2, created: true, appended: 0 })
    expect(await db.shot.count({ where: { cardId } })).toBe(2 * total - 1)
  })
})

describe("refreshProjections", () => {
  it("rechnet veraltete Projektionen neu", async () => {
    const [input] = season(1, 1300)
    const { cardId } = await writeRevision(db, input)
    const before = await projectionOf(cardId)
    await db.cardProjection.update({
      where: { cardId },
      data: { version: "p0-alt", values: {} },
    })
    // auch Scheiben anderer Testdateien können veraltet sein: so lange, bis keine mehr übrig ist
    while ((await refreshProjections(db, { limit: 50 })) > 0);
    const after = await projectionOf(cardId)
    expect(after.version).toBe(projectionVersion())
    expect(after.values).toEqual(before.values)
  })
})

describe("setDisciplineFamily", () => {
  it("die Scheiben ziehen mit der Familie ihrer Disziplin mit", async () => {
    const [input] = season(1, 1400)
    const { cardId } = await writeRevision(db, input)
    const other = await db.family.create({ data: { name: `Andere ${cardId}` } })
    try {
      expect(await setDisciplineFamily(db, site.disciplineId, other.id)).toBeGreaterThanOrEqual(1)
      expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).familyId).toBe(other.id)
    } finally {
      await setDisciplineFamily(db, site.disciplineId, site.familyId)
      await db.family.delete({ where: { id: other.id } })
    }
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).familyId).toBe(
      site.familyId
    )
  })
})
