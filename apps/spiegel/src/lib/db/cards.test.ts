import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cardMarks, cardProjection, projectionVersion } from "@vereinsheim/shot-core/projection"

import { createPrismaClient } from "@/lib/db"
import { generateSeason, liveStates, type GeneratedCard } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import {
  CardIdentityConflictError,
  refreshProjections,
  refreshStaleProjections,
  setDisciplineFamily,
  shotChange,
  toMetricShot,
  writeRevision,
  type ShotInput,
} from "./cards"
import { cardWithShots } from "./reads"

const db = createPrismaClient()
let site: TestSite
const DAY_MS = 86_400_000

beforeAll(async () => {
  site = await createTestSite(db, "cards")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const season = (cards: number, scheibenIdBase: number, seed = 20261010) =>
  generateSeason({
    seed,
    cards,
    firstMs: Date.UTC(2026, 0, 5, 17, 30),
    everyDays: 3,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase,
  })

/** die erste Scheibe einer kleinen Saison mit der gewünschten Form */
function cardWhere(scheibenIdBase: number, wanted: (card: GeneratedCard) => boolean) {
  const card = season(12, scheibenIdBase).find(wanted)
  if (!card) throw new Error("keine passende Scheibe im Seed")
  return card
}
const withProbe = (card: GeneratedCard) => card.probeBefore.length > 0
const probeOnly = (card: GeneratedCard) => card.shots.every((shot) => shot.stellung === 0)

const projectionOf = (cardId: string) => db.cardProjection.findUniqueOrThrow({ where: { cardId } })
const shotsOf = (cardId: string) => cardWithShots(db, { cardId, ownerId: site.ownerId })

describe("writeRevision", () => {
  it("schreibt Schüsse und Projektion, die Seite der Scheibe liest dieselben Schüsse", async () => {
    const [input] = season(1, 1000)
    const result = await writeRevision(db, input)
    expect(result).toMatchObject({ number: 1, change: "created", added: input.shots.length })

    const card = await shotsOf(result.cardId)
    expect(card?.shots).toEqual(input.shots.map(toMetricShot))
    expect(card).toMatchObject({ kind: input.card.kind, revision: 1, official: "rings" })

    const stored = await projectionOf(result.cardId)
    const expected = cardProjection(card!)
    expect(stored.revisionId).toBe(result.revisionId)
    expect(stored.version).toBe(projectionVersion())
    expect(stored.values).toEqual(expected.values)
    expect(stored.records).toEqual(JSON.parse(JSON.stringify(expected.records)))
    // die Lagen für die kleinen Scheiben der Übersichten, wie der Fachkern sie aus den Schüssen macht
    expect(stored.marks).toEqual(cardMarks(card!.shots))
    expect((stored.marks as unknown[]).length).toBeGreaterThan(0)
  })

  it("dieselben Schüsse in anderer Folge: unverändert, die Merkmale der Scheibe ändern sich trotzdem", async () => {
    const [input] = season(1, 1100)
    const first = await writeRevision(db, input)
    const again = await writeRevision(db, {
      ...input,
      card: { ...input.card, flags: ["ausgenommen"] },
      shots: [...input.shots].reverse(),
    })
    expect(again).toEqual({ ...first, change: "unchanged", added: 0, removed: 0 })
    expect(await db.cardRevision.count({ where: { cardId: first.cardId } })).toBe(1)
    const card = await db.card.findUniqueOrThrow({ where: { id: first.cardId } })
    expect(card.flags).toEqual(["ausgenommen"])
  })

  it("die Wertung wie am Stand folgt der Anzeigeart der Schüsse; ohne Zehntel und ganze Ringe null", async () => {
    const [input] = season(1, 1150)
    const standOf = async (cardId: string) =>
      (await db.card.findUniqueOrThrow({ where: { id: cardId } })).standScoring
    const withMode = (displayMode: number | null) =>
      input.shots.map((shot) => ({ ...shot, displayMode }))

    const first = await writeRevision(db, input)
    expect(await standOf(first.cardId)).toBe("decimal")
    await writeRevision(db, { ...input, shots: withMode(8) })
    expect(await standOf(first.cardId)).toBe("rings")
    await writeRevision(db, { ...input, shots: withMode(null) })
    expect(await standOf(first.cardId)).toBeNull()
  })

  it("ein korrigierter Wertungsschuss ergibt Revision 2; die vorige bleibt, unveränderte Schüsse behalten ihren Fingerabdruck", async () => {
    const input = cardWhere(1200, (c) => !probeOnly(c))
    const first = await writeRevision(db, input)
    const changed = input.shots.map((shot, i) =>
      i === input.shots.length - 1
        ? { ...shot, decimalTenths: 109, ring: 10, innerTen: true }
        : shot
    )
    const second = await writeRevision(db, { ...input, shots: changed, reason: "korrektur" })
    expect(second).toMatchObject({ number: 2, change: "created", cardId: first.cardId })

    const card = await db.card.findUniqueOrThrow({ where: { id: first.cardId } })
    expect(card.currentRevisionId).toBe(second.revisionId)
    expect(await db.shot.count({ where: { cardId: first.cardId } })).toBe(2 * input.shots.length)
    const [{ fingerprint }] = await db.shot.findMany({
      where: { revisionId: first.revisionId, seq: input.shots[0].seq },
      select: { fingerprint: true },
    })
    expect(await db.shot.count({ where: { cardId: first.cardId, fingerprint } })).toBe(2)
    expect((await projectionOf(first.cardId)).revisionId).toBe(second.revisionId)
    expect((await shotsOf(first.cardId))?.shots.at(-1)?.decimalTenths).toBe(109)
  })

  it("Besitzer bleibt beim Aktualisieren; Sportpass bleibt, wenn er fehlt, und wird nur mit null geleert", async () => {
    const [input] = season(1, 1300)
    const card = { ...input.card, sportpassId: BigInt(12_345_678) }
    const { cardId } = await writeRevision(db, { ...input, card })
    await writeRevision(db, {
      ...input,
      card: { ...card, ownerId: null, sportpassId: undefined, flags: ["x"] },
    })
    let row = await db.card.findUniqueOrThrow({ where: { id: cardId } })
    expect(row.ownerId).toBe(site.ownerId)
    expect(row.sportpassId).toBe(BigInt(12_345_678))
    await writeRevision(db, { ...input, card: { ...card, sportpassId: null } })
    row = await db.card.findUniqueOrThrow({ where: { id: cardId } })
    expect(row.sportpassId).toBeNull()
  })

  it("Scheibe nur aus dem PDF: ohne Quelle angelegt, später mit ihren Rohdaten verbunden; eine andere Kennung ist ein Fehler", async () => {
    const [input] = season(1, 1400)
    const pdfShots: ShotInput[] = input.shots.map((shot) => ({
      ...shot,
      xUm: null,
      yUm: null,
      distanceTenthsUm: null,
      firedAtMs: null,
      displayMode: null,
    }))
    const pdf = await writeRevision(db, {
      card: { ...input.card, sourceId: null, scheibenId: null, origin: "pdf" },
      shots: pdfShots,
      reason: "qr",
    })
    let row = await db.card.findUniqueOrThrow({ where: { id: pdf.cardId } })
    expect(row).toMatchObject({ sourceId: null, scheibenId: null, origin: "pdf" })

    const raw = await writeRevision(db, { ...input, cardId: pdf.cardId })
    expect(raw).toMatchObject({ cardId: pdf.cardId, number: 2, change: "created" })
    row = await db.card.findUniqueOrThrow({ where: { id: pdf.cardId } })
    expect(row).toMatchObject({ sourceId: site.sourceId, scheibenId: 1400, origin: "raw" })
    // ein späterer Stand aus dem PDF nimmt die Rohdaten nicht wieder weg
    await writeRevision(db, {
      cardId: pdf.cardId,
      card: { ...input.card, sourceId: null, scheibenId: null, origin: "pdf" },
      shots: input.shots,
      reason: "qr",
    })
    expect(await db.card.findUniqueOrThrow({ where: { id: pdf.cardId } })).toMatchObject({
      sourceId: site.sourceId,
      origin: "raw",
    })
    await expect(
      writeRevision(db, { ...input, cardId: pdf.cardId, card: { ...input.card, scheibenId: 9 } })
    ).rejects.toThrow(RangeError)
    await expect(writeRevision(db, { ...input, cardId: "keine" })).rejects.toThrow()
  })

  it("doppelte Stellung und Treffer sind ein Fehler", async () => {
    const [input] = season(1, 1500)
    await expect(
      writeRevision(db, { ...input, shots: [...input.shots, input.shots[0]] })
    ).rejects.toThrow(RangeError)
  })
})

describe("offener Durchgang (SF-03, SF-67, SF-72)", () => {
  it("Probe, dann Wertung: eine Revision; der erste Wertungsschuss löscht die Probe, wie am Ausdruck", async () => {
    const input = cardWhere(2000, withProbe)
    const states = liveStates(input)
    const results = []
    for (const shots of states) results.push(await writeRevision(db, { ...input, shots }))
    const probeCount = input.probeBefore.length
    expect(results[0].change).toBe("created")
    expect(results.slice(1).every((r) => r.change === "updated" && r.number === 1)).toBe(true)
    // der Stand mit dem ersten Wertungsschuss: die Probe weg, ein Schuss dazu
    expect(results[probeCount]).toMatchObject({ added: 1, removed: probeCount })

    const { cardId } = results[0]
    expect(await db.cardRevision.count({ where: { cardId } })).toBe(1)
    expect(await db.shot.count({ where: { cardId } })).toBe(input.shots.length)
    const card = await shotsOf(cardId)
    expect(card?.shots).toEqual(input.shots.map(toMetricShot))
    expect((await projectionOf(cardId)).values).toEqual(cardProjection(card!).values)
  })

  it("Neustart der Probe (SF-72): dieselbe Revision, nur der neue Block bleibt", async () => {
    const input = cardWhere(2100, probeOnly)
    const first = await writeRevision(db, input)
    // neu begonnen: wieder Treffer 1, an anderer Stelle und später
    const restart: ShotInput[] = [
      {
        ...input.shots[0],
        seq: 1,
        xUm: 1230,
        yUm: -450,
        firedAtMs: input.shots.at(-1)!.firedAtMs! + 60_000,
      },
    ]
    const result = await writeRevision(db, { ...input, shots: restart })
    expect(result).toMatchObject({
      cardId: first.cardId,
      number: 1,
      change: "updated",
      added: 1,
      removed: input.shots.length,
    })
    expect(await db.shot.count({ where: { cardId: first.cardId } })).toBe(1)
  })

  it("fehlt danach ein Wertungsschuss, ist das eine Korrektur: Revision 2", async () => {
    const input = cardWhere(2200, (c) => !probeOnly(c))
    await writeRevision(db, input)
    const result = await writeRevision(db, { ...input, shots: input.shots.slice(0, -1) })
    expect(result).toMatchObject({ number: 2, change: "created" })
  })
})

describe("shotChange", () => {
  // reine Funktion: ohne Anlage, die Kennungen spielen keine Rolle
  const input = generateSeason({
    seed: 1,
    cards: 12,
    firstMs: 0,
    everyDays: 1,
    sourceId: 0,
    disciplineId: 0,
    ownerId: "-",
    scheibenIdBase: 0,
  }).find((card) => card.shots.every((shot) => shot.stellung !== 0))!
  const shots = input.shots
  const probe = (n: number): ShotInput => ({ ...shots[0], stellung: 0, treffer: n, series: null })

  it("gleiche Schüsse, neue Schüsse, Probe weg", () => {
    expect(shotChange(shots, shots)).toEqual({ kind: "same" })
    expect(shotChange(shots.slice(0, 3), shots.slice(0, 5))).toEqual({
      kind: "update",
      add: shots.slice(3, 5),
      remove: [],
    })
    expect(shotChange([probe(1), probe(2)], shots.slice(0, 1))).toEqual({
      kind: "update",
      add: shots.slice(0, 1),
      remove: [probe(1), probe(2)],
    })
  })

  it("ein Wertungsschuss geändert oder weg ist eine Korrektur, auch wenn neue dazukommen", () => {
    const changed = shots.slice(0, 5).map((s, i) => (i === 2 ? { ...s, decimalTenths: 0 } : s))
    expect(shotChange(shots.slice(0, 3), changed)).toEqual({ kind: "correction" })
    const flagged = shots
      .slice(0, 5)
      .map((s, i) => (i === 2 ? { ...s, flags: ["verdaechtig"] } : s))
    expect(shotChange(shots.slice(0, 3), flagged)).toEqual({ kind: "correction" })
    expect(shotChange(shots.slice(0, 3), shots.slice(1, 5))).toEqual({ kind: "correction" })
  })

  it("doppelte Stellung und Treffer sind ein Fehler", () => {
    expect(() => shotChange([], [shots[0], shots[0]])).toThrow(RangeError)
  })
})

describe("Folgenummer (SF-26)", () => {
  it("ein älterer Snapshot ändert weder Schüsse noch Merkmale", async () => {
    const input = cardWhere(2400, (c) => !probeOnly(c))
    const first = await writeRevision(db, { ...input, sequence: 10 })
    const older = await writeRevision(db, {
      ...input,
      card: { ...input.card, flags: ["alt"] },
      shots: input.shots.slice(0, 3),
      sequence: 9,
    })
    expect(older).toMatchObject({ cardId: first.cardId, change: "stale", number: 1 })
    const row = await db.card.findUniqueOrThrow({ where: { id: first.cardId } })
    expect(row.flags).toEqual([])
    expect(row.lastSequence).toBe(BigInt(10))
    expect(await db.shot.count({ where: { cardId: first.cardId } })).toBe(input.shots.length)
    expect((await writeRevision(db, { ...input, sequence: 11 })).change).toBe("unchanged")
    expect((await db.card.findUniqueOrThrow({ where: { id: first.cardId } })).lastSequence).toBe(
      BigInt(11)
    )
  })
})

describe("wiederkehrende ScheibenID (SF-77)", () => {
  it("Wochen später mit anderen Schüssen: Konflikt statt stillem Zusammenführen; der nächste Zyklus ist eine eigene Scheibe", async () => {
    const [a, b] = season(2, 2500)
    const first = await writeRevision(db, a)
    const later = {
      ...b,
      card: {
        ...b.card,
        scheibenId: a.card.scheibenId,
        startedAtMs: a.card.startedAtMs + 50 * DAY_MS,
      },
    }
    await expect(writeRevision(db, later)).rejects.toThrow(CardIdentityConflictError)
    const next = await writeRevision(db, { ...later, card: { ...later.card, cycle: 1 } })
    expect(next.cardId).not.toBe(first.cardId)
    expect(next.change).toBe("created")
    // dieselben Schüsse mit verschobenem Beginn sind dieselbe Scheibe
    const moved = await writeRevision(db, {
      ...a,
      card: { ...a.card, startedAtMs: a.card.startedAtMs + 50 * DAY_MS },
    })
    expect(moved).toMatchObject({ cardId: first.cardId, change: "unchanged" })
  })
})

describe("refreshProjections", () => {
  it("rechnet veraltete Projektionen nach, nur in der gewählten Quelle", async () => {
    const [a, b] = season(2, 2600)
    const ids = [(await writeRevision(db, a)).cardId, (await writeRevision(db, b)).cardId]
    const before = await projectionOf(ids[0])
    await db.cardProjection.updateMany({
      where: { cardId: { in: ids } },
      data: { version: "p0-alt", values: {}, marks: [] },
    })
    expect(await refreshProjections(db, { sourceId: site.sourceId })).toBe(2)
    expect(await refreshProjections(db, { sourceId: site.sourceId })).toBe(0)
    const after = await projectionOf(ids[0])
    expect(after.version).toBe(projectionVersion())
    expect(after.values).toEqual(before.values)
    expect(after.marks).toEqual(before.marks)
  })

  it("beim Start alle veralteten in Stapeln, bis keine übrig ist", async () => {
    const inputs = season(3, 2800)
    const ids: string[] = []
    for (const input of inputs) ids.push((await writeRevision(db, input)).cardId)
    await db.cardProjection.updateMany({
      where: { cardId: { in: ids } },
      data: { version: "p1-alt", marks: [] },
    })
    expect(await refreshStaleProjections(db, { batch: 1, sourceId: site.sourceId })).toBe(3)
    expect(await refreshStaleProjections(db, { batch: 1, sourceId: site.sourceId })).toBe(0)
    const rows = await db.cardProjection.findMany({ where: { cardId: { in: ids } } })
    expect(rows.every((row) => row.version === projectionVersion())).toBe(true)
    expect(rows.every((row) => (row.marks as unknown[]).length > 0)).toBe(true)
  })

  it("eine Projektion einer früheren Revision gilt als veraltet", async () => {
    const input = cardWhere(2700, (c) => !probeOnly(c))
    const first = await writeRevision(db, input)
    const second = await writeRevision(db, { ...input, shots: input.shots.slice(0, -1) })
    await db.cardProjection.update({
      where: { cardId: first.cardId },
      data: { revisionId: first.revisionId },
    })
    expect(await refreshProjections(db, { sourceId: site.sourceId })).toBe(1)
    expect((await projectionOf(first.cardId)).revisionId).toBe(second.revisionId)
  })
})

describe("setDisciplineFamily", () => {
  it("die Scheiben ziehen mit der Familie ihrer Disziplin mit", async () => {
    const [input] = season(1, 2800)
    const { cardId } = await writeRevision(db, input)
    const other = await db.family.create({ data: { slug: `andere-${cardId}`, name: "Andere" } })
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
