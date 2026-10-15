import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { DEFAULT_LIST, DEFAULT_PROGRESS } from "@vereinsheim/shot-ui/nav/routes"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"
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
      expect(card.projection.values).toEqual({})
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
      form: start.model.form?.route.query.scoring,
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
        form: "decimal",
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
        form: "decimal",
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
