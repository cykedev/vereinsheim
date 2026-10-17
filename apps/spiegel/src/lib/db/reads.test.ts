import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  cardValues,
  FLAG_COUNTED_AS_MATCH,
  periodRecords,
  type PeriodCard,
} from "@vereinsheim/shot-core/analysis"
import { FLAG_SUSPICIOUS, metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { cardMarks, projectedRecords, projectedValues } from "@vereinsheim/shot-core/projection"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { chooseCardKind, chooseCardScoring, refreshProjections, writeRevision } from "./cards"
import {
  cardWithShots,
  familyCards,
  familyScorings,
  latestCardStart,
  marksOfCards,
  ownerCards,
  pendingCount,
  pendingFirstCards,
  trashCards,
  waitingForDiscipline,
} from "./reads"

const db = createPrismaClient()
let site: TestSite
let otherDisciplineId: number
let otherFamilyId: number
const FIRST_MS = Date.UTC(2026, 3, 1, 16, 30)
const DAY_MS = 86_400_000
const PENDING_MS = FIRST_MS + 200 * DAY_MS

beforeAll(async () => {
  site = await createTestSite(db, "reads")
  const family = await db.family.create({
    data: { slug: `lg-freihand-${site.siteId}`, name: `Luftgewehr ${site.siteId}` },
  })
  otherFamilyId = family.id
  otherDisciplineId = (
    await db.discipline.create({
      data: { siteId: site.siteId, meytonId: 10_100_040, name: "LG 40", familyId: family.id },
    })
  ).id
  const common = { sourceId: site.sourceId, ownerId: site.ownerId, everyDays: 4 }
  // 30 Scheiben LP über 40 Abende, darunter je eine unvollständige, ausgenommene, verdächtige und als Wertung
  // gezählte (sie prüfen die Filter der Rekorde durch die Datenbank), dazu am letzten Abend eine Scheibe LG
  const lp = generateSeason({
    ...common,
    seed: 7,
    cards: 30,
    firstMs: FIRST_MS,
    disciplineId: site.disciplineId,
    scheibenIdBase: 2000,
  })
  const special: Record<number, (input: (typeof lp)[number]) => (typeof lp)[number]> = {
    4: (input) => ({ ...input, card: { ...input.card, complete: false } }),
    7: (input) => ({ ...input, card: { ...input.card, flags: ["ausgenommen"] } }),
    10: (input) => ({
      ...input,
      shots: input.shots.map((shot, i) => (i === 2 ? { ...shot, flags: [FLAG_SUSPICIOUS] } : shot)),
    }),
    13: (input) => ({ ...input, card: { ...input.card, flags: [FLAG_COUNTED_AS_MATCH] } }),
  }
  for (const [i, input] of lp.entries()) await writeRevision(db, special[i]?.(input) ?? input)
  const [lg] = generateSeason({
    ...common,
    seed: 8,
    cards: 1,
    firstMs: FIRST_MS + 9 * 4 * DAY_MS + 3 * 60 * 60_000,
    disciplineId: otherDisciplineId,
    scheibenIdBase: 3000,
  })
  await writeRevision(db, lg)
  // eine gelöschte Scheibe (Papierkorb) fehlt in jeder Übersicht
  const [trash] = generateSeason({
    ...common,
    seed: 9,
    cards: 1,
    firstMs: FIRST_MS + DAY_MS,
    disciplineId: site.disciplineId,
    scheibenIdBase: 4000,
  })
  const { cardId } = await writeRevision(db, trash)
  await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
  // drei wartende Scheiben nach allen anderen: zwei unter einer SportpassID, eine unter einer anderen; sie
  // fehlen in jeder Übersicht, auch als neuester Abend
  const pending = generateSeason({
    ...common,
    everyDays: 1,
    seed: 10,
    cards: 3,
    firstMs: PENDING_MS,
    disciplineId: site.disciplineId,
    scheibenIdBase: 5000,
  })
  for (const [i, input] of pending.entries())
    await writeRevision(db, {
      ...input,
      card: { ...input.card, ownerPending: true, sportpassId: i < 2 ? BigInt(111) : BigInt(222) },
    })
})
afterAll(async () => {
  await site.remove()
  await db.family.delete({ where: { id: otherFamilyId } })
  await db.$disconnect()
})

describe("familyCards", () => {
  it("die Scheiben der Familie nach Beginn, ohne Schüsse und ohne gelöschte", async () => {
    const cards = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    expect(cards).toHaveLength(30)
    expect(cards.map((c) => c.startedAtMs)).toEqual(
      [...cards.map((c) => c.startedAtMs)].sort((a, b) => a - b)
    )
    expect(cards.filter((c) => !c.complete)).toHaveLength(1)
    expect(cards.filter((c) => c.projection.suspicious)).toHaveLength(1)
    expect(cards.map((c) => c.flags).filter((f) => f.length)).toEqual([
      ["ausgenommen"],
      [FLAG_COUNTED_AS_MATCH],
    ])
    // amtliche Wertung von der Disziplin (SF-74), nur mit Wertungsschüssen
    expect(new Set(cards.map((c) => c.official))).toEqual(new Set(["rings", undefined]))
    for (const card of cards) expect(card).not.toHaveProperty("shots")
    expect(cards.every((c) => c.familyId === site.familyId)).toBe(true)
  })

  it("im Zeitraum: Beginn eingeschlossen, Ende ausgeschlossen", async () => {
    const all = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const fromMs = all[3].startedAtMs
    const toMs = all[9].startedAtMs
    const range = await familyCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      fromMs,
      toMs,
    })
    expect(range.map((c) => c.id)).toEqual(all.slice(3, 9).map((c) => c.id))
  })

  it("Werte und Rekorde aus der Datenbank gleich der Rechnung aus den Schüssen", async () => {
    const overview = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const cards: PeriodCard[] = []
    for (const { id } of overview)
      cards.push((await cardWithShots(db, { cardId: id, ownerId: site.ownerId }))!)
    expect(overview.filter((c) => c.projection.probeOnly).length).toBeGreaterThan(0)
    expect(overview.filter((c) => c.kind === "competition").length).toBeGreaterThan(0)

    for (const scoring of ["decimal", "rings"] as const) {
      for (const key of ["result.decimal", "result.decimalMean", "group.enclosingDiameter"]) {
        const metric = metricByKey(key) as MetricDefinition
        for (const includeProbeOnly of [false, true])
          expect(projectedValues(overview, metric, scoring, { includeProbeOnly })).toEqual(
            cardValues(cards, metric, scoring, { includeProbeOnly })
          )
      }
      for (const options of [
        {},
        { includeProbeOnly: true },
        { kind: "competition" as const },
        { kind: "training" as const, includeProbeOnly: true },
      ])
        expect(projectedRecords(overview, scoring, options)).toEqual(
          periodRecords(cards, scoring, options)
        )
    }
  })
})

describe("Start", () => {
  it("der letzte Abend über alle Familien", async () => {
    const latest = await latestCardStart(db, site.ownerId)
    expect(latest).toBe(FIRST_MS + 9 * 4 * DAY_MS + 3 * 60 * 60_000)
    const evening = await ownerCards(db, {
      ownerId: site.ownerId,
      fromMs: FIRST_MS + 9 * 4 * DAY_MS,
      toMs: latest! + 1,
    })
    expect(evening.map((c) => c.familyId)).toEqual([
      site.familyId,
      site.familyId,
      site.familyId,
      otherFamilyId,
    ])
  })
})

describe("Übersichten", () => {
  it("alle eigenen, nicht gelöschten Scheiben mit Projektion, Familie und Scheibenbild, nach Beginn", async () => {
    const cards = await ownerCards(db, { ownerId: site.ownerId })
    expect(cards).toHaveLength(31)
    expect(cards.map((c) => c.startedAtMs)).toEqual(
      [...cards.map((c) => c.startedAtMs)].sort((a, b) => a - b)
    )
    const families = await db.family.findMany({
      where: { id: { in: [site.familyId, otherFamilyId] } },
      select: { slug: true },
    })
    expect(new Set(cards.map((c) => c.family?.slug))).toEqual(new Set(families.map((f) => f.slug)))
    // Scheibenbild aus der Disziplin: LP mit, das LG des Tests ohne
    const lp = cards.find((c) => c.disciplineId === site.disciplineId && !c.projection.probeOnly)!
    expect(lp).toMatchObject({ targetId: "lp-10m", official: "rings" })
    expect(cards.find((c) => c.disciplineId === otherDisciplineId)?.targetId).toBeNull()
    expect(await ownerCards(db, { ownerId: "jemand-anderes" })).toEqual([])
  })

  it("die Lagen der kleinen Scheiben nur für die verlangten, eigenen und nicht gelöschten Scheiben", async () => {
    const [a, b] = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const trash = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, deletedAt: { not: null } },
    })
    const marks = await marksOfCards(db, { ownerId: site.ownerId, ids: [a.id, b.id, trash.id] })
    expect(Object.keys(marks).sort()).toEqual([a.id, b.id].sort())
    const shots = (await cardWithShots(db, { cardId: a.id, ownerId: site.ownerId }))!.shots
    expect(marks[a.id]).toEqual(cardMarks(shots))
    expect(marks[a.id].length).toBe(a.projection.printedShots)
    expect(await marksOfCards(db, { ownerId: "jemand-anderes", ids: [a.id] })).toEqual({})
    expect(await marksOfCards(db, { ownerId: site.ownerId, ids: [] })).toEqual({})
  })
})

describe("Wartende Scheiben", () => {
  it("fehlen in Liste, Start und auf ihrer Seite", async () => {
    const pending = await db.card.findMany({
      where: { sourceId: site.sourceId, ownerPending: true },
      select: { id: true },
    })
    expect(pending).toHaveLength(3)
    const ids = new Set(pending.map((c) => c.id))
    const ownerId = site.ownerId
    expect((await ownerCards(db, { ownerId })).some((c) => ids.has(c.id))).toBe(false)
    expect(
      (await familyCards(db, { ownerId, familyId: site.familyId })).some((c) => ids.has(c.id))
    ).toBe(false)
    expect(await latestCardStart(db, ownerId)).toBeLessThan(PENDING_MS)
    expect(await cardWithShots(db, { cardId: pending[0].id, ownerId })).toBeNull()
  })

  it("je SportpassID die jüngste wartende, mit der Zahl der weiteren; gezählt je SportpassID", async () => {
    // mit der Historie warten womöglich Scheiben aus Jahren: an den letzten Abend erinnert man sich
    const newest111 = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, ownerPending: true, sportpassId: BigInt(111) },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    })
    expect(newest111.startedAt.getTime()).toBeGreaterThan(PENDING_MS)
    const first = await pendingFirstCards(db, site.ownerId)
    expect(first.map((p) => [p.sportpassId, p.more, p.card.startedAtMs])).toEqual([
      ["222", 0, PENDING_MS + 90 * 60_000],
      ["111", 1, newest111.startedAt.getTime()],
    ])
    expect(first[0].card.family?.slug).toBeDefined()
    expect(await pendingCount(db, site.ownerId)).toBe(2)
    expect(await pendingFirstCards(db, "jemand-anderes")).toEqual([])
    expect(await pendingCount(db, "jemand-anderes")).toBe(0)
  })

  it("die Lagen einer wartenden Scheibe nur für „Offen“", async () => {
    const [first] = await pendingFirstCards(db, site.ownerId)
    const ownerId = site.ownerId
    expect(await marksOfCards(db, { ownerId, ids: [first.card.id] })).toEqual({})
    expect(
      Object.keys(await marksOfCards(db, { ownerId, ids: [first.card.id], pending: true }))
    ).toEqual([first.card.id])
  })

  it("dieselbe SportpassID an einer anderen Anlage ist ein eigener Eintrag", async () => {
    const other = await createTestSite(db, "reads-b")
    try {
      const [input] = generateSeason({
        sourceId: other.sourceId,
        ownerId: site.ownerId,
        everyDays: 1,
        seed: 11,
        cards: 1,
        firstMs: PENDING_MS + 10 * DAY_MS,
        disciplineId: other.disciplineId,
        scheibenIdBase: 5100,
      })
      await writeRevision(db, {
        ...input,
        card: { ...input.card, ownerPending: true, sportpassId: BigInt(111) },
      })
      const first = await pendingFirstCards(db, site.ownerId)
      expect(first.map((p) => [p.sportpassId, p.more])).toEqual([
        ["111", 0],
        ["222", 0],
        ["111", 1],
      ])
      expect(await pendingCount(db, site.ownerId)).toBe(3)
    } finally {
      await db.card.deleteMany({ where: { source: { siteId: other.siteId } } })
      await other.remove()
    }
  })
})

describe("cardWithShots", () => {
  it("eine gelöschte, unbekannte oder fremde Scheibe gibt es nicht", async () => {
    const trash = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, deletedAt: { not: null } },
    })
    const ownerId = site.ownerId
    expect(await cardWithShots(db, { cardId: trash.id, ownerId })).toBeNull()
    expect(await cardWithShots(db, { cardId: "keine", ownerId })).toBeNull()
    const [own] = await familyCards(db, { ownerId, familyId: site.familyId })
    expect(await cardWithShots(db, { cardId: own.id, ownerId })).not.toBeNull()
    expect(await cardWithShots(db, { cardId: own.id, ownerId: "jemand-anderes" })).toBeNull()
  })

  it("ein Training nur aus Probe hat keine amtliche Wertung, auch wenn die Disziplin eine hat", async () => {
    const overview = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const probeOnly = overview.find((c) => c.projection.probeOnly)!
    const withMatch = overview.find((c) => !c.projection.probeOnly)!
    expect(probeOnly).not.toHaveProperty("official")
    expect(withMatch.official).toBe("rings")
    const page = await cardWithShots(db, { cardId: probeOnly.id, ownerId: site.ownerId })
    expect(page).not.toHaveProperty("official")
    const all = await ownerCards(db, { ownerId: site.ownerId })
    expect(all.find((c) => c.id === probeOnly.id)).not.toHaveProperty("official")
  })

  it("ohne amtliche Wertung an der Disziplin keine an der Scheibe", async () => {
    const [lg] = await familyCards(db, { ownerId: site.ownerId, familyId: otherFamilyId })
    expect(lg).not.toHaveProperty("official")
    expect(await cardWithShots(db, { cardId: lg.id, ownerId: site.ownerId })).not.toHaveProperty(
      "official"
    )
  })
})

describe("Wertung der Scheibe", () => {
  it("Wettkampf in der amtlichen, Training wie am Stand, die Wahl vor der Vorgabe; Übersicht und Seite gleich", async () => {
    const ownerId = site.ownerId
    const cards = await familyCards(db, { ownerId, familyId: site.familyId })
    // die Testscheiben zeigen am Stand Zehntel (Anzeigeart 1), die Disziplin wertet amtlich ganze Ringe
    expect(cards.some((c) => c.kind === "competition" && c.official)).toBe(true)
    expect(cards.some((c) => c.kind === "training")).toBe(true)
    for (const card of cards)
      expect(card.scoring).toBe(card.kind === "competition" && card.official ? "rings" : "decimal")
    const [lg] = await familyCards(db, { ownerId, familyId: otherFamilyId })
    expect(lg.scoring).toBe("decimal")

    const competition = cards.find((c) => c.kind === "competition" && c.official)!
    const training = cards.find((c) => c.kind === "training" && !c.projection.probeOnly)!
    expect((await cardWithShots(db, { cardId: competition.id, ownerId }))?.scoring).toBe("rings")
    expect((await cardWithShots(db, { cardId: training.id, ownerId }))?.scoring).toBe("decimal")
    await db.card.update({ where: { id: training.id }, data: { scoringChoice: "rings" } })
    try {
      const all = await ownerCards(db, { ownerId })
      expect(all.find((c) => c.id === training.id)?.scoring).toBe("rings")
      expect((await cardWithShots(db, { cardId: training.id, ownerId }))?.scoring).toBe("rings")
    } finally {
      await db.card.update({ where: { id: training.id }, data: { scoringChoice: null } })
    }
  })
})

describe("familyScorings", () => {
  it("die gespeicherten Wertungen der Familien eines Schützen nach Kennung, nur seine", async () => {
    expect(await familyScorings(db, site.ownerId)).toEqual({})
    await db.familyScoring.create({
      data: { userId: site.ownerId, familyId: otherFamilyId, scoring: "rings" },
    })
    const { slug } = await db.family.findUniqueOrThrow({ where: { id: otherFamilyId } })
    expect(await familyScorings(db, site.ownerId)).toEqual({ [slug]: "rings" })
    expect(await familyScorings(db, "jemand-anderes")).toEqual({})
  })
})

describe("Art der Scheibe", () => {
  it("die gewählte Art vor der Art der Quelle, in Übersicht und Seite; die Vorgabe der Wertung folgt ihr", async () => {
    const ownerId = site.ownerId
    const cards = await familyCards(db, { ownerId, familyId: site.familyId })
    const training = cards.find((c) => c.kind === "training" && !c.projection.probeOnly)!
    // Training: wie am Stand (die Testscheiben zeigen Zehntel)
    expect(training.scoring).toBe("decimal")
    await db.card.update({ where: { id: training.id }, data: { kindChoice: "competition" } })
    try {
      const overview = (await ownerCards(db, { ownerId })).find((c) => c.id === training.id)!
      const page = (await cardWithShots(db, { cardId: training.id, ownerId }))!
      // Wettkampf: amtlich (die Disziplin wertet ganze Ringe)
      expect([overview.kind, overview.scoring]).toEqual(["competition", "rings"])
      expect([page.kind, page.scoring]).toEqual(["competition", "rings"])
      // eine gewählte Wertung bleibt
      await db.card.update({ where: { id: training.id }, data: { scoringChoice: "decimal" } })
      expect((await cardWithShots(db, { cardId: training.id, ownerId }))?.scoring).toBe("decimal")
    } finally {
      await db.card.update({
        where: { id: training.id },
        data: { kindChoice: null, scoringChoice: null },
      })
    }
  })
})

describe("Liste der Scheibe", () => {
  it("Übersicht und Seite nennen die Liste aus Meyton, ohne Liste null", async () => {
    const ownerId = site.ownerId
    const [first, second] = await familyCards(db, { ownerId, familyId: site.familyId })
    const list = await db.ranking.create({
      data: { siteId: site.siteId, name: "RWK_LP reads", kind: null },
    })
    await db.card.update({ where: { id: first.id }, data: { rankingId: list.id } })
    try {
      const expected = { id: list.id, name: "RWK_LP reads" }
      const family = await familyCards(db, { ownerId, familyId: site.familyId })
      expect(family.find((c) => c.id === first.id)?.list).toEqual(expected)
      expect(family.find((c) => c.id === second.id)?.list).toBeNull()
      expect((await ownerCards(db, { ownerId })).find((c) => c.id === first.id)?.list).toEqual(
        expected
      )
      expect((await cardWithShots(db, { cardId: first.id, ownerId }))?.list).toEqual(expected)
      expect((await cardWithShots(db, { cardId: second.id, ownerId }))?.list).toBeNull()
    } finally {
      await db.card.update({ where: { id: first.id }, data: { rankingId: null } })
      await db.ranking.delete({ where: { id: list.id } })
    }
  })
})

describe("chooseCardKind", () => {
  it("nur die eigene, nicht gelöschte Scheibe mit Wertungsschüssen; nur Probe bleibt Training", async () => {
    const ownerId = site.ownerId
    const cards = await familyCards(db, { ownerId, familyId: site.familyId })
    const own = cards.find((c) => !c.projection.probeOnly)!
    const probeOnly = cards.find((c) => c.projection.probeOnly)!
    const trash = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, deletedAt: { not: null } },
    })
    const choiceOf = async (id: string) =>
      (await db.card.findUniqueOrThrow({ where: { id } })).kindChoice
    try {
      expect(await chooseCardKind(db, { cardId: own.id, ownerId, kind: "competition" })).toBe(
        "saved"
      )
      expect(await choiceOf(own.id)).toBe("competition")
      expect(
        await chooseCardKind(db, { cardId: own.id, ownerId: "jemand-anderes", kind: "training" })
      ).toBe("missing")
      expect(await chooseCardKind(db, { cardId: trash.id, ownerId, kind: "competition" })).toBe(
        "missing"
      )
      expect(await chooseCardKind(db, { cardId: "keine", ownerId, kind: "competition" })).toBe(
        "missing"
      )
      expect(await chooseCardKind(db, { cardId: probeOnly.id, ownerId, kind: "competition" })).toBe(
        "probeOnly"
      )
      expect(await choiceOf(probeOnly.id)).toBeNull()
      expect(await choiceOf(own.id)).toBe("competition")
    } finally {
      await db.card.update({ where: { id: own.id }, data: { kindChoice: null } })
    }
  })

  it("eine Scheibe, deren Projektion noch fehlt, lässt sich markieren; danach ist sie wieder gerechnet", async () => {
    const ownerId = site.ownerId
    const [first] = await familyCards(db, { ownerId, familyId: site.familyId })
    await db.cardProjection.delete({ where: { cardId: first.id } })
    try {
      expect(await chooseCardKind(db, { cardId: first.id, ownerId, kind: "competition" })).toBe(
        "saved"
      )
    } finally {
      await db.card.update({ where: { id: first.id }, data: { kindChoice: null } })
      await refreshProjections(db, { sourceId: site.sourceId })
    }
    expect((await familyCards(db, { ownerId, familyId: site.familyId }))[0].id).toBe(first.id)
  })
})

describe("ignorierte Disziplinen und wartende Einordnung", () => {
  it("eine ignorierte fehlt überall, auch im Papierkorb; wieder gezeigt ist sie zurück; wartende gezählt", async () => {
    // die übrigen Testdaten haben schon wartende Scheiben (Disziplin „LG 40“ ohne Scheibenbild)
    const baseline = await waitingForDiscipline(db, site.ownerId)
    const discipline = await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 18_051_010,
        name: `LG Schach ${site.siteId}`,
        targetId: "lp-10m",
        familyId: site.familyId,
        ignoredAt: new Date(),
      },
    })
    const [generated, deleted] = generateSeason({
      seed: 99,
      cards: 12,
      firstMs: Date.UTC(2026, 8, 1, 18),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: discipline.id,
      ownerId: site.ownerId,
      scheibenIdBase: 9_900,
    }).filter((card) => card.shots.some((shot) => shot.stellung !== 0))
    const { cardId } = await writeRevision(db, generated)
    const { cardId: trashedId } = await writeRevision(db, deleted)
    await db.card.update({ where: { id: trashedId }, data: { deletedAt: new Date() } })
    const ids = async () => (await ownerCards(db, { ownerId: site.ownerId })).map((c) => c.id)
    expect(await ids()).not.toContain(cardId)
    expect(await chooseCardScoring(db, { cardId, ownerId: site.ownerId, scoring: "rings" })).toBe(
      false
    )
    // wartend in einer ignorierten Disziplin: „Offen“ und die Zahl am Start-Symbol zeigen sie nicht
    const pendingBefore = await pendingCount(db, site.ownerId)
    const [, , waitingInput] = generateSeason({
      seed: 98,
      cards: 12,
      firstMs: Date.UTC(2026, 7, 1, 18),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: discipline.id,
      ownerId: site.ownerId,
      scheibenIdBase: 9_950,
    }).filter((card) => card.shots.some((shot) => shot.stellung !== 0))
    const { cardId: waitingId } = await writeRevision(db, {
      ...waitingInput,
      card: { ...waitingInput.card, ownerPending: true, sportpassId: BigInt(98_765) },
    })
    expect(await pendingCount(db, site.ownerId)).toBe(pendingBefore)
    expect((await pendingFirstCards(db, site.ownerId)).map((p) => p.card.id)).not.toContain(
      waitingId
    )
    expect(await cardWithShots(db, { cardId, ownerId: site.ownerId })).toBeNull()
    expect((await trashCards(db, site.ownerId)).map((t) => t.card.id)).not.toContain(trashedId)
    expect(await waitingForDiscipline(db, site.ownerId)).toBe(baseline)

    await db.discipline.update({ where: { id: discipline.id }, data: { ignoredAt: null } })
    expect(await ids()).toContain(cardId)
    expect(await pendingCount(db, site.ownerId)).toBe(pendingBefore + 1)
    expect((await trashCards(db, site.ownerId)).map((t) => t.card.id)).toContain(trashedId)

    // neu und ohne Scheibenbild: die Scheibe wartet auf die Einordnung
    await db.discipline.update({ where: { id: discipline.id }, data: { targetId: null } })
    expect(await waitingForDiscipline(db, site.ownerId)).toBe(baseline + 1)
    await db.discipline.update({ where: { id: discipline.id }, data: { confirmedAt: new Date() } })
    expect(await waitingForDiscipline(db, site.ownerId)).toBe(baseline)

    await db.card.deleteMany({ where: { disciplineId: discipline.id } })
    await db.discipline.delete({ where: { id: discipline.id } })
  })
})
