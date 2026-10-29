import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { DEFAULT_LIST, DEFAULT_PROGRESS, urlFromRoute } from "@vereinsheim/shot-ui/nav/routes"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"
import { writeEnteredCard } from "./db/entered"
import { comparePageData } from "./compare"
import { listPageData, progressPageData, startPageData } from "./overview"

const db = createPrismaClient()
let site: TestSite
let lgFamily: { id: number; slug: string }
let otherOwner: string
const ids = { lp: [] as string[], lg: [] as string[], trash: "", foreign: "" }
const FIRST_MS = Date.UTC(2026, 5, 1, 17)
const DAY_MS = 86_400_000
const context = {
  timeZone: "Europe/Berlin",
  nowMs: FIRST_MS + 40 * DAY_MS,
  named: [],
}

beforeAll(async () => {
  site = await createTestSite(db, "overview")
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
      data: { email: `overview-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  const season = (
    seed: number,
    cards: number,
    firstMs: number,
    disciplineId: number,
    ownerId: string,
    base: number
  ) =>
    generateSeason({
      seed,
      cards,
      firstMs,
      everyDays: 3,
      sourceId: site.sourceId,
      disciplineId,
      ownerId,
      scheibenIdBase: base,
    })
  for (const input of season(1, 6, FIRST_MS, site.disciplineId, site.ownerId, 8000))
    ids.lp.push((await writeRevision(db, input)).cardId)
  // die neueste Scheibe ist Luftgewehr: Start zeigt ihren Abend, die Liste fällt auf ihre Familie zurück
  for (const input of season(2, 2, FIRST_MS + 30 * DAY_MS, lgDiscipline.id, site.ownerId, 8100))
    ids.lg.push((await writeRevision(db, input)).cardId)
  const [trash] = season(3, 1, FIRST_MS + 31 * DAY_MS, lgDiscipline.id, site.ownerId, 8200)
  ids.trash = (await writeRevision(db, trash)).cardId
  await db.card.update({ where: { id: ids.trash }, data: { deletedAt: new Date() } })
  const [foreign] = season(4, 1, FIRST_MS + 32 * DAY_MS, lgDiscipline.id, otherOwner, 8300)
  ids.foreign = (await writeRevision(db, foreign)).cardId
})
afterAll(async () => {
  await site.remove()
  await db.family.delete({ where: { id: lgFamily.id } })
  await db.user.delete({ where: { id: otherOwner } })
  await db.$disconnect()
})

const rowIds = (evenings: { rows: { id: string }[] }[]) =>
  evenings.flatMap((e) => e.rows.map((r) => r.id))

describe("startPageData", () => {
  it("der Abend der neuesten eigenen Scheibe; Lagen genau für seine Scheiben", async () => {
    const { model, marks, families } = await startPageData(db, site.ownerId, context)
    expect(families.map((f) => f.value)).toEqual([
      lgFamily.slug,
      expect.stringMatching(/^lp-freihand-/),
    ])
    const shown = model.blocks.flatMap((block) => block.rows.map((row) => row.id))
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every((id) => ids.lg.includes(id))).toBe(true)
    expect(Object.keys(marks).sort()).toEqual([...shown].sort())
  })
})

describe("listPageData", () => {
  it("ohne oder mit unbekannter Familie die der neuesten Scheibe; Lagen genau für die Zeilen", async () => {
    for (const family of [null, "gibt-es-nicht"]) {
      const { list } = await listPageData(db, site.ownerId, { ...DEFAULT_LIST, family }, context)
      expect(list?.option.value).toBe(lgFamily.slug)
      const rows = rowIds(list!.model.evenings)
      expect(rows.sort()).toEqual([...ids.lg].sort())
      expect(Object.keys(list!.marks).sort()).toEqual(rows.sort())
    }
  })

  it("die gewählte Familie; gelöschte und fremde Scheiben nie", async () => {
    const lp = (await startPageData(db, site.ownerId, context)).families[1].value
    const { list } = await listPageData(db, site.ownerId, { ...DEFAULT_LIST, family: lp }, context)
    const rows = rowIds(list!.model.evenings)
    expect(rows.sort()).toEqual([...ids.lp].sort())
    for (const id of [ids.trash, ids.foreign]) {
      expect(rows).not.toContain(id)
      expect(list!.marks).not.toHaveProperty(id)
    }
    const other = await listPageData(
      db,
      site.ownerId,
      { ...DEFAULT_LIST, family: lgFamily.slug },
      context
    )
    expect(rowIds(other.list!.model.evenings)).not.toContain(ids.foreign)
  })

  it("ohne eigene Scheiben keine Liste", async () => {
    const empty = await listPageData(db, "jemand-ohne-scheiben", DEFAULT_LIST, context)
    expect(empty).toEqual({ list: null, families: [] })
  })
})

describe("progressPageData", () => {
  const all = { ...DEFAULT_PROGRESS, choice: { type: "all" as const } }

  it("die Familie der neuesten Scheibe in ihrer Wertung, die Lagen nur der Ablesung", async () => {
    await db.familyScoring.create({
      data: { userId: site.ownerId, familyId: lgFamily.id, scoring: "rings" },
    })
    const { progress } = await progressPageData(
      db,
      site.ownerId,
      { ...all, family: "gibt-es-nicht", scoring: "decimal" },
      context
    ).finally(() => db.familyScoring.deleteMany({ where: { userId: site.ownerId } }))
    expect(progress!.state).toMatchObject({ family: lgFamily.slug, scoring: "rings" })
    // gerechnet in der Wertung der Familie, nicht in der Wertung der Adresse
    expect(progress!.model.metric.key).toBe("result.ringsMean")
    expect(progress!.model.cards.map((c) => c.id).sort()).toEqual([...ids.lg].sort())
    expect(Object.keys(progress!.marks)).toEqual([progress!.model.reading!.card.id])
    // leicht: ohne Werte, Rekorde und Felder der App
    for (const card of progress!.model.cards) {
      expect(card.metrics).toEqual({})
      expect(card).not.toHaveProperty("family")
    }
  })

  it("eine Wahl aus der Adresse ist die Ablesung; gelöschte und fremde Scheiben nie", async () => {
    const lp = (await startPageData(db, site.ownerId, context)).families[1].value
    const chosen = ids.lp[2]
    const { progress } = await progressPageData(
      db,
      site.ownerId,
      { ...all, family: lp, chosen },
      context
    )
    expect(progress!.model.reading).toMatchObject({ chosen: true, card: { id: chosen } })
    expect(Object.keys(progress!.marks)).toEqual([chosen])
    const lg = await progressPageData(db, site.ownerId, { ...all, family: lgFamily.slug }, context)
    const shown = lg.progress!.model.cards.map((c) => c.id)
    expect(shown).not.toContain(ids.trash)
    expect(shown).not.toContain(ids.foreign)
    expect(await progressPageData(db, "jemand-ohne-scheiben", all, context)).toEqual({
      progress: null,
      families: [],
    })
  })
})

describe("Wertung je Familie", () => {
  const all = { ...DEFAULT_PROGRESS, choice: { type: "all" as const } }
  const scorings = async () => {
    const lp = (await startPageData(db, site.ownerId, context)).families[1].value
    const start = await startPageData(db, site.ownerId, context)
    const list = (family: string) =>
      listPageData(db, site.ownerId, { ...DEFAULT_LIST, family }, context)
    const progress = (family: string) =>
      progressPageData(db, site.ownerId, { ...all, family }, context)
    return {
      start: start.model.blocks.map((block) => [block.family, block.scoring]),
      // die Form führt auf die Seite Vergleichen, die in der Wertung der Familie rechnet (die Adresse trägt keine)
      form: start.model.form && urlFromRoute(start.model.form.route),
      list: {
        lg: (await list(lgFamily.slug)).list?.model.scoring,
        lp: (await list(lp)).list?.model.scoring,
      },
      progress: {
        lg: (await progress(lgFamily.slug)).progress?.state.scoring,
        lp: (await progress(lp)).progress?.state.scoring,
      },
    }
  }

  it("ohne Speicher die häufigste Wertung ihrer Scheiben, gespeichert die gespeicherte; Start je Block", async () => {
    try {
      // die Testscheiben zeigen am Stand Zehntel; das Luftgewehr hat keine amtliche Wertung
      expect(await scorings()).toEqual({
        start: [[lgFamily.slug, "decimal"]],
        form: `/compare?family=${lgFamily.slug}`,
        list: { lg: "decimal", lp: expect.any(String) },
        progress: { lg: "decimal", lp: expect.any(String) },
      })
      // beide Scheiben LG auf ganze Ringe gestellt: die häufigste ist ganze Ringe
      await db.card.updateMany({ where: { id: { in: ids.lg } }, data: { scoringChoice: "rings" } })
      expect(await scorings()).toMatchObject({
        start: [[lgFamily.slug, "rings"]],
        list: { lg: "rings" },
        progress: { lg: "rings" },
      })
      // gespeichert geht vor; die andere Familie bleibt, wie sie ist
      await db.familyScoring.create({
        data: { userId: site.ownerId, familyId: lgFamily.id, scoring: "decimal" },
      })
      await db.familyScoring.create({
        data: { userId: site.ownerId, familyId: site.familyId, scoring: "rings" },
      })
      expect(await scorings()).toEqual({
        start: [[lgFamily.slug, "decimal"]],
        form: `/compare?family=${lgFamily.slug}`,
        list: { lg: "decimal", lp: "rings" },
        progress: { lg: "decimal", lp: "rings" },
      })
      // ein anderer Schütze sieht seine eigene Wertung, nicht diese
      const foreign = await listPageData(
        db,
        otherOwner,
        { ...DEFAULT_LIST, family: lgFamily.slug },
        context
      )
      expect(foreign.list?.model.scoring).toBe("decimal")
    } finally {
      await db.card.updateMany({ where: { id: { in: ids.lg } }, data: { scoringChoice: null } })
      await db.familyScoring.deleteMany({ where: { userId: site.ownerId } })
    }
  })
})

describe("Art der Scheibe", () => {
  it("der Filter „Art“ der Liste nimmt die gewählte Art vor der Art der Quelle", async () => {
    const lp = (await startPageData(db, site.ownerId, context)).families[1].value
    const list = async (kind: "training" | "competition") =>
      rowIds(
        (await listPageData(db, site.ownerId, { ...DEFAULT_LIST, family: lp, kind }, context)).list
          ?.model.evenings ?? []
      )
    const cards = await db.card.findMany({ where: { id: { in: ids.lp } } })
    const training = cards.find((c) => c.kind === "training")!
    expect(await list("training")).toContain(training.id)
    expect(await list("competition")).not.toContain(training.id)
    await db.card.update({ where: { id: training.id }, data: { kindChoice: "competition" } })
    try {
      expect(await list("competition")).toContain(training.id)
      expect(await list("training")).not.toContain(training.id)
    } finally {
      await db.card.update({ where: { id: training.id }, data: { kindChoice: null } })
    }
  })
})

describe("Scheiben ohne Einzelschüsse", () => {
  // ein eigenes Konto und eine eigene Familie: Die übrigen Tests sehen diese Scheiben nicht
  const entered = {
    owner: "",
    familyId: 0,
    slug: "",
    disciplineId: 0,
    empty: "",
    sums: "",
    shots: "",
  }
  const all = { ...DEFAULT_PROGRESS, choice: { type: "all" as const } }

  beforeAll(async () => {
    entered.owner = (
      await db.user.create({
        data: { email: `overview-entered-${site.siteId}@example.com`, passwordHash: "-" },
      })
    ).id
    entered.slug = `lg-eingetragen-${site.siteId}`
    entered.familyId = (
      await db.family.create({ data: { slug: entered.slug, name: "LG eingetragen" } })
    ).id
    entered.disciplineId = (
      await db.discipline.create({
        data: {
          siteId: site.siteId,
          meytonId: null,
          name: "LG 40 eingetragen",
          familyId: entered.familyId,
          targetId: "lg-10m",
          officialScoring: "rings",
          plannedShots: 40,
          confirmedAt: new Date(),
        },
      })
    ).id
    const write = async (
      details: Parameters<typeof writeEnteredCard>[1]["details"],
      day: number
    ) => {
      const result = await writeEnteredCard(db, {
        ownerId: entered.owner,
        origin: day === 0 ? "pdf" : "manual",
        disciplineId: entered.disciplineId,
        startedAtMs: FIRST_MS + day * DAY_MS,
        kind: "training",
        details,
        reason: "eingetragen",
      })
      if (result.kind !== "saved") throw new Error(result.kind)
      return result.cardId
    }
    entered.empty = await write({}, 0)
    entered.sums = await write(
      { series: [93, 95, 94, 96].map((rings, i) => ({ series: i + 1, rings })) },
      1
    )
    entered.shots = await write(
      {
        shots: [10, 9, 10, 8, 9, 10, 10, 9, 9, 10].map((ring) => ({
          series: 1,
          ring,
          decimalTenths: null,
        })),
      },
      2
    )
  })
  afterAll(async () => {
    await db.card.deleteMany({ where: { ownerId: entered.owner } })
    await db.discipline.delete({ where: { id: entered.disciplineId } })
    await db.family.delete({ where: { id: entered.familyId } })
    await db.user.delete({ where: { id: entered.owner } })
  })

  it("Start, Liste und Fortschritt rechnen, Schusszahl und Ø aus den Summen, die leere ohne Werte", async () => {
    await expect(startPageData(db, entered.owner, context)).resolves.toBeDefined()
    await expect(
      progressPageData(db, entered.owner, { ...all, family: entered.slug }, context)
    ).resolves.toBeDefined()
    const { list } = await listPageData(
      db,
      entered.owner,
      { ...DEFAULT_LIST, family: entered.slug },
      context
    )
    const rows = list!.model.evenings.flatMap((e) => e.rows)
    const sums = rows.find((r) => r.id === entered.sums)!
    expect(sums.shots).toBe(40)
    expect(sums.mean).not.toBeNull()
    expect(sums.mean).toBeCloseTo(9.45, 9)
    expect(sums.resultScoring).toBe("rings")
    const empty = rows.find((r) => r.id === entered.empty)!
    expect(empty).toMatchObject({ result: null, mean: null, shots: 0 })
    expect(empty.kind).not.toBe("probe")
    expect(rows.find((r) => r.id === entered.shots)?.shots).toBe(10)
  })
})

describe("Einschießen", () => {
  // ein eigenes Konto mit zwei Familien: Die übrigen Tests sehen diese Scheiben nicht
  const warm = {
    owner: "",
    families: [] as { id: number; slug: string }[],
    disciplines: [] as number[],
    warmup: "",
    scored: "",
    deletedScored: "",
    beforeDeleted: "",
    crossFamily: "",
    alone: "",
  }
  const all = { ...DEFAULT_PROGRESS, choice: { type: "all" as const } }
  // vier Abende im Abstand von zwei Tagen; Uhrzeiten in Berlin (MESZ, UTC + 2)
  const at = (evening: number, hour: number, minute = 0) =>
    Date.UTC(2026, 6, 1 + 2 * evening, hour - 2, minute)

  beforeAll(async () => {
    warm.owner = (
      await db.user.create({
        data: { email: `overview-warmup-${site.siteId}@example.com`, passwordHash: "-" },
      })
    ).id
    for (const name of ["lp", "lg"]) {
      const family = await db.family.create({
        data: { slug: `${name}-einschiessen-${site.siteId}`, name: `${name} Einschießen` },
      })
      warm.families.push(family)
      warm.disciplines.push(
        (
          await db.discipline.create({
            data: {
              siteId: site.siteId,
              meytonId: null,
              name: `${name} 40 Einschießen`,
              familyId: family.id,
              targetId: "lp-10m",
            },
          })
        ).id
      )
    }
    let scheibenId = 8600
    // eine Scheibe aus `generateSeason`, als nur Probe (alle Schüsse Probe) oder mit Wertung, zu `startedAtMs`
    const write = async (startedAtMs: number, probe: boolean, family = 0) => {
      const [input] = generateSeason({
        seed: scheibenId,
        cards: 1,
        firstMs: startedAtMs,
        everyDays: 1,
        sourceId: site.sourceId,
        disciplineId: warm.disciplines[family],
        ownerId: warm.owner,
        scheibenIdBase: scheibenId++,
      })
      const shots = [...input.probeBefore, ...input.shots].map((shot, i) => ({
        ...shot,
        seq: i + 1,
        treffer: i + 1,
        stellung: probe ? 0 : 1,
        series: probe ? null : Math.floor(i / 10) + 1,
      }))
      const card = { ...input.card, startedAtMs, kind: "training" as const }
      return (await writeRevision(db, { ...input, card, shots })).cardId
    }
    // Abend 0: Probe 18:20, Wertung 19:00 in derselben Familie
    warm.warmup = await write(at(0, 18, 20), true)
    warm.scored = await write(at(0, 19), false)
    // Abend 1: Probe vor einer Wertung, die gelöscht ist
    warm.beforeDeleted = await write(at(1, 18, 20), true)
    warm.deletedScored = await write(at(1, 19), false)
    await db.card.update({ where: { id: warm.deletedScored }, data: { deletedAt: new Date() } })
    // Abend 2: Probe in der einen Familie, Wertung in der anderen
    warm.crossFamily = await write(at(2, 18, 20), true)
    await write(at(2, 19), false, 1)
    // Abend 3, der letzte: nur eine Probe-Scheibe
    warm.alone = await write(at(3, 18, 20), true)
  })
  afterAll(async () => {
    await db.card.deleteMany({ where: { ownerId: warm.owner } })
    await db.discipline.deleteMany({ where: { id: { in: warm.disciplines } } })
    await db.family.deleteMany({ where: { id: { in: warm.families.map((f) => f.id) } } })
    await db.user.delete({ where: { id: warm.owner } })
  })

  const progress = async (includeWarmup: boolean) =>
    (await progressPageData(
      db,
      warm.owner,
      { ...all, family: warm.families[0].slug, includeWarmup },
      context
    ))!.progress!.model

  it("nur die Probe vor einer Wertung desselben Abends und derselben Familie ist Einschießen", async () => {
    const model = await progress(false)
    const marked = model.cards.filter((card) => card.warmup).map((card) => card.id)
    expect(marked).toEqual([warm.warmup])
    // gelöschte Wertung, andere Familie, Abend nur mit Probe: kein Einschießen, alle zählen
    expect(model.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining([warm.beforeDeleted, warm.crossFamily, warm.alone, warm.scored])
    )
    expect(model.cards.map((card) => card.id)).not.toContain(warm.deletedScored)
  })

  it("der Fortschritt zählt Einschießen nur mit dem Schalter", async () => {
    const without = await progress(false)
    const withWarmup = await progress(true)
    expect(without.cards).toHaveLength(5)
    expect(without.excludedWarmup).toBe(1)
    expect(without.summary.cards).toBe(4)
    expect(without.values.map((v) => v.id)).not.toContain(warm.warmup)
    expect(without.reasons[warm.warmup]).toBe("Einschießen zählt nicht")
    expect(withWarmup.excludedWarmup).toBe(0)
    expect(withWarmup.summary.cards).toBe(5)
  })

  it("Start zählt einen Abend nur mit Probe", async () => {
    const { model } = await startPageData(db, warm.owner, { ...context, nowMs: at(3, 22) })
    const block = model.blocks.find((b) => b.family === warm.families[0].slug)!
    expect(block.rows.map((row) => row.id)).toEqual([warm.alone])
    expect(block.mean).not.toBeNull()
  })

  it("Vergleichen zählt Einschießen nur mit dem Schalter", async () => {
    const query = (includeWarmup: boolean) =>
      ({
        type: "kind",
        family: warm.families[0].slug,
        range: { type: "all" },
        includeWarmup,
      }) as const
    const without = await comparePageData(db, warm.owner, query(false), context)
    const withWarmup = await comparePageData(db, warm.owner, query(true), context)
    expect(without?.model?.b.cards).toBe(4)
    expect(withWarmup?.model?.b.cards).toBe(5)
  })
})
