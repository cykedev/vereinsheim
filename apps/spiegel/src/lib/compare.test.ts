import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { DEFAULT_COMPARE, type CompareQuery } from "@vereinsheim/shot-ui/nav/routes"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { comparePageData } from "./compare"
import { writeRevision } from "./db/cards"
import { previousInFamily } from "./db/reads"

const db = createPrismaClient()
let site: TestSite
let lgFamily: { id: number; slug: string }
let lpFamily: string
let otherOwner: string
const ids = { lp: [] as string[], lg: "", trash: "", foreign: "", loose: [] as string[] }
// Abende am 1., 4., 7. und 10. Juni 2026 zu je drei Scheiben
const FIRST_MS = Date.UTC(2026, 5, 1, 17)
const DAY_MS = 86_400_000
const context = { timeZone: "Europe/Berlin", nowMs: FIRST_MS + 40 * DAY_MS, named: [] }

beforeAll(async () => {
  site = await createTestSite(db, "compare")
  lgFamily = await db.family.create({
    data: { slug: `lg-freihand-${site.siteId}`, name: `Luftgewehr ${site.siteId}` },
  })
  const lgDiscipline = await db.discipline.create({
    data: {
      siteId: site.siteId,
      meytonId: 10_100_040,
      name: "LG 40",
      familyId: lgFamily.id,
      targetId: "lg-10m",
    },
  })
  otherOwner = (
    await db.user.create({
      data: { email: `compare-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  const season = (
    seed: number,
    cards: number,
    firstMs: number,
    discipline: number,
    owner: string,
    base: number
  ) =>
    generateSeason({
      seed,
      cards,
      firstMs,
      everyDays: 3,
      sourceId: site.sourceId,
      disciplineId: discipline,
      ownerId: owner,
      scheibenIdBase: base,
    })
  for (const input of season(1, 12, FIRST_MS, site.disciplineId, site.ownerId, 9000))
    ids.lp.push((await writeRevision(db, input)).cardId)
  // die ersten sechs Wettkampf, die übrigen Training
  for (const [i, id] of ids.lp.entries())
    await db.card.update({ where: { id }, data: { kind: i < 6 ? "competition" : "training" } })
  // Luftgewehr ist älter: Die neueste Scheibe ist Luftpistole
  const [lg] = season(2, 1, FIRST_MS - 10 * DAY_MS, lgDiscipline.id, site.ownerId, 9100)
  ids.lg = (await writeRevision(db, lg)).cardId
  const [trash] = season(3, 1, FIRST_MS + 2 * DAY_MS, site.disciplineId, site.ownerId, 9200)
  ids.trash = (await writeRevision(db, trash)).cardId
  await db.card.update({ where: { id: ids.trash }, data: { deletedAt: new Date() } })
  const [foreign] = season(4, 1, FIRST_MS + 2 * DAY_MS, site.disciplineId, otherOwner, 9300)
  ids.foreign = (await writeRevision(db, foreign)).cardId
  // zwei eigene Scheiben einer Disziplin ohne Familie: in keiner Übersicht
  const loose = await db.discipline.create({
    data: {
      siteId: site.siteId,
      meytonId: 10_100_041,
      name: "LG 40 ohne Familie",
      targetId: "lg-10m",
    },
  })
  for (const input of season(5, 2, FIRST_MS - 20 * DAY_MS, loose.id, site.ownerId, 9400))
    ids.loose.push((await writeRevision(db, input)).cardId)
  lpFamily = (
    await db.card.findUniqueOrThrow({
      where: { id: ids.lp[0] },
      select: { family: { select: { slug: true } } },
    })
  ).family!.slug
})
afterAll(async () => {
  await site.remove()
  await db.family.delete({ where: { id: lgFamily.id } })
  await db.user.delete({ where: { id: otherOwner } })
  await db.$disconnect()
})

const data = (query: CompareQuery) => comparePageData(db, site.ownerId, query, context)

describe("comparePageData: Gruppen", () => {
  it("Wettkampf und Training: A ist Wettkampf, B Training, die Familie gewählt", async () => {
    const query = { type: "kind", family: lpFamily, range: { type: "all" } } as const
    const page = await data({ ...query, includeWarmup: false })
    // drei der erzeugten Scheiben sind nur Probe vor einer Wertung ihres Abends (Einschießen), zwei davon Wettkampf:
    // Sie zählen nur mit dem Schalter
    expect(page?.model?.a).toMatchObject({ name: "Wettkampf", cards: 4 })
    expect(page?.model?.b).toMatchObject({ name: "Training", cards: 5 })
    const withWarmup = await data({ ...query, includeWarmup: true })
    expect(withWarmup?.model?.a.cards).toBe(6)
    expect(withWarmup?.model?.b.cards).toBe(6)
    expect(page?.names.a).toBe("Alles")
    expect(page?.family).toBe(lpFamily)
  })

  it("zwei Zeiträume: Scheiben in beiden zählen nur in A", async () => {
    const query = {
      type: "periods",
      family: lpFamily,
      a: { type: "free", from: "2026-06-07", to: "2026-07-10" },
      b: { type: "free", from: "2026-06-01", to: "2026-06-07" },
      kind: "all",
    } as const
    // mit Einschießen alle Scheiben, ohne (die Vorgabe) zählen die drei aus dem Fall davor auf keiner Seite
    const withWarmup = await data({ ...query, includeWarmup: true })
    expect(withWarmup?.model?.a.cards).toBe(6)
    expect(withWarmup?.model?.b.cards).toBe(6)
    expect(withWarmup?.model?.shared).toBe(3)
    const page = await data({ ...query, includeWarmup: false })
    expect(page?.model?.a.cards).toBe(5)
    expect(page?.model?.b.cards).toBe(4)
    expect(page?.model?.shared).toBe(2)
    expect(page?.ranges?.a.label).toBe("07.06.2026 – 10.07.2026")
  })

  it("ohne zwei Scheiben nur die neuesten zwei fürs Blatt", async () => {
    const page = await data({ ...DEFAULT_COMPARE, family: lpFamily } as CompareQuery)
    expect(page?.choices.map((c) => c.id)).toEqual([ids.lp[11], ids.lp[10]])
  })

  it("gelöschte und fremde Scheiben nie, auch nicht im Blatt", async () => {
    const page = await data({ type: "cards", family: null, a: ids.lp[0], b: ids.lp[1] })
    const choices = page!.choices.map((c) => c.id)
    expect(choices).not.toContain(ids.trash)
    expect(choices).not.toContain(ids.foreign)
    expect(choices.sort()).toEqual([...ids.lp].sort())
  })

  it("ohne eigene Scheiben null", async () => {
    expect(await comparePageData(db, "jemand-ohne-scheiben", DEFAULT_COMPARE, context)).toBeNull()
  })
})

describe("comparePageData: zwei Scheiben", () => {
  it("ohne Ids die neueste Scheibe und die davor in ihrer Familie", async () => {
    const page = await data({ type: "cards", family: null, a: null, b: null })
    expect(page?.query).toEqual({ type: "cards", family: lpFamily, a: ids.lp[11], b: ids.lp[10] })
    // die Wertung der Familie: Luftpistole zählt amtlich ganze Ringe
    expect(page?.scoring).toBe("rings")
    expect(page?.model?.unit).toBe("shot")
    expect(page?.problem).toBeNull()
  })

  it("eine andere Familie ohne Ids: deren neueste Scheibe, ihr Blatt", async () => {
    const page = await data({ type: "cards", family: lgFamily.slug, a: null, b: null })
    expect(page?.query).toMatchObject({ family: lgFamily.slug, a: ids.lg })
    expect(page?.family).toBe(lgFamily.slug)
    expect(page?.choices.map((c) => c.id)).toEqual([ids.lg])
    // Luftgewehr hat nur eine Scheibe: B fehlt
    expect(page?.problem).toBe("Wähle zwei Scheiben.")
  })

  it("dieselbe Scheibe, verschiedene Familien, fremde und gelöschte: ein Hinweis, kein Modell", async () => {
    const cases: [string, string, string][] = [
      [ids.lp[0], ids.lp[0], "Wähle zwei verschiedene Scheiben."],
      [
        ids.lp[0],
        ids.lg,
        "Die beiden Scheiben gehören zu verschiedenen Disziplinen. Wähle zwei aus einer.",
      ],
      [ids.lp[0], ids.foreign, "Wähle zwei Scheiben."],
      [ids.trash, ids.lp[0], "Wähle zwei Scheiben."],
      [ids.loose[0], ids.loose[1], "Wähle zwei Scheiben."],
    ]
    for (const [a, b, problem] of cases) {
      const page = await data({ type: "cards", family: null, a, b })
      expect(page?.model, `${a} ${b}`).toBeNull()
      expect(page?.problem).toBe(problem)
      // „Zur Scheibe“ nur zu einer eigenen, sichtbaren Scheibe A
      if (a === ids.trash) expect(page?.backCard).toBeNull()
    }
  })
})

describe("previousInFamily", () => {
  const card = async (id: string) =>
    db.card.findUniqueOrThrow({ where: { id }, select: { startedAt: true } })
  const previous = async (id: string) =>
    previousInFamily(db, {
      ownerId: site.ownerId,
      family: lpFamily,
      startedAtMs: (await card(id)).startedAt.getTime(),
      id,
    })

  it("die eigene Scheibe davor in der Familie; gelöschte und fremde dazwischen zählen nicht", async () => {
    // am 3. Juni liegen eine gelöschte und eine fremde Scheibe zwischen dem 1. und dem 4. Juni
    expect(await previous(ids.lp[3])).toBe(ids.lp[2])
    expect(await previous(ids.lp[1])).toBe(ids.lp[0])
    expect(await previous(ids.lp[0])).toBeNull()
  })
})
