import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason, type GeneratedCard } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { chooseCardDiscipline, disciplineOptions, writeRevision } from "./cards"

// Die Disziplin einer Scheibe wählt der Schütze; jeder spätere Stand aus Meyton lässt die Wahl stehen und schreibt nur
// die Disziplin am Stand (`standDisciplineId`).

const db = createPrismaClient()
let site: TestSite
let other: TestSite
/** dasselbe Scheibenbild, andere Familie, Schusszahl so, dass die Testscheibe vollständig ist */
let auflage: number
let auflageFamily: number
/** anderes Scheibenbild */
let rifle: number
/** dasselbe Scheibenbild, vom Admin ignoriert */
let ignored: number

const season = (scheibenIdBase: number, ownerId = site.ownerId) =>
  generateSeason({
    seed: 20261024,
    cards: 12,
    firstMs: Date.UTC(2026, 1, 3, 17, 30),
    everyDays: 3,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId,
    scheibenIdBase,
  })

/** eine Scheibe mit Wertung unter der Schusszahl der DisziplinID (40), geschrieben wie vom Einlesen */
async function written(scheibenIdBase: number, ownerId = site.ownerId) {
  const card = season(scheibenIdBase, ownerId).find((c) => {
    const match = matchShots(c)
    return match > 0 && match < 40
  })
  if (!card) throw new Error("keine Testscheibe mit Wertung unter 40 Schuss")
  const { version } = await db.discipline.findUniqueOrThrow({ where: { id: site.disciplineId } })
  const result = await writeRevision(db, {
    ...card,
    card: { ...card.card, flags: ["unvollstaendig"], complete: false, disciplineVersion: version },
  })
  return { cardId: result.cardId, card }
}

/** derselbe Stand noch einmal, wie die Brücke ihn mit neuer Folgenummer schickt; wahlweise mit anderer Disziplin */
async function again(card: GeneratedCard, sequence: number, disciplineId = site.disciplineId) {
  const { version } = await db.discipline.findUniqueOrThrow({ where: { id: disciplineId } })
  return writeRevision(db, {
    ...card,
    sequence,
    card: {
      ...card.card,
      disciplineId,
      flags: ["unvollstaendig"],
      complete: false,
      disciplineVersion: version,
    },
  })
}

const matchShots = (card: GeneratedCard) => card.shots.filter((s) => s.stellung !== 0).length
const row = (id: string) =>
  db.card.findUniqueOrThrow({
    where: { id },
    select: {
      disciplineId: true,
      standDisciplineId: true,
      familyId: true,
      flags: true,
      complete: true,
      disciplineVersion: true,
    },
  })

beforeAll(async () => {
  site = await createTestSite(db, "cards-choice")
  other = await createTestSite(db, "cards-choice-other")
  // die Disziplin der Testanlage zählt sonst 5 Schuss (Schusscode der DisziplinID): wie LP 40 vom Admin auf 40
  await db.discipline.update({ where: { id: site.disciplineId }, data: { plannedShots: 40 } })
  auflageFamily = (
    await db.family.create({
      data: { slug: `lp-auflage-${site.siteId}`, name: `Luftpistole Auflage ${site.siteId}` },
    })
  ).id
  auflage = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_211_030,
        name: "LP Auflage 30",
        familyId: auflageFamily,
        targetId: "lp-10m",
      },
    })
  ).id
  rifle = (
    await db.discipline.create({
      data: { siteId: site.siteId, meytonId: 10_110_040, name: "LG 40", targetId: "lg-10m" },
    })
  ).id
  ignored = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_299_000,
        name: "LP Spiel",
        targetId: "lp-10m",
        ignoredAt: new Date(),
      },
    })
  ).id
})

afterAll(async () => {
  await site.remove()
  await other.remove()
  await db.family.delete({ where: { id: auflageFamily } })
  await db.$disconnect()
})

describe("chooseCardDiscipline", () => {
  it("stellt um: Familie zieht mit, Merkmale nach der gewählten Disziplin, die vom Stand bleibt vermerkt", async () => {
    const { cardId, card } = await written(7_100)
    // die Schusszahl der Auflage ist die der Testscheibe: danach vollständig
    await db.discipline.update({ where: { id: auflage }, data: { plannedShots: matchShots(card) } })
    const result = await chooseCardDiscipline(db, {
      cardId,
      ownerId: site.ownerId,
      disciplineId: auflage,
    })
    expect(result).toBe("saved")
    const after = await row(cardId)
    expect(after.disciplineId).toBe(auflage)
    expect(after.standDisciplineId).toBe(site.disciplineId)
    expect(after.familyId).toBe(auflageFamily)
    expect(after.flags).not.toContain("unvollstaendig")
    const { version } = await db.discipline.findUniqueOrThrow({ where: { id: auflage } })
    expect(after.disciplineVersion).toBe(version)
  })

  it("ein neuer Stand aus Meyton lässt die Wahl stehen und rechnet mit ihr", async () => {
    const { cardId, card } = await written(7_200)
    await db.discipline.update({ where: { id: auflage }, data: { plannedShots: matchShots(card) } })
    await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
    const result = await again(card, Date.now())
    expect(result.cardId).toBe(cardId)
    const after = await row(cardId)
    expect(after.disciplineId).toBe(auflage)
    expect(after.standDisciplineId).toBe(site.disciplineId)
    expect(after.familyId).toBe(auflageFamily)
    // der Adapter schickt „unvollständig“ nach LP 40; gerechnet wird mit der gewählten Schusszahl
    expect(after.flags).not.toContain("unvollstaendig")
    expect(after.complete).toBe(true)
  })

  it("die Disziplin vom Stand wieder wählen hebt die Wahl auf", async () => {
    const { cardId } = await written(7_300)
    await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
    const result = await chooseCardDiscipline(db, {
      cardId,
      ownerId: site.ownerId,
      disciplineId: site.disciplineId,
    })
    expect(result).toBe("saved")
    const after = await row(cardId)
    expect(after.disciplineId).toBe(site.disciplineId)
    expect(after.standDisciplineId).toBeNull()
    expect(after.familyId).toBe(site.familyId)
    expect(after.flags).toContain("unvollstaendig")
  })

  it("schreibt Meyton später die gewählte Disziplin, fällt die Wahl weg", async () => {
    const { cardId, card } = await written(7_400)
    await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
    await again(card, Date.now(), auflage)
    const after = await row(cardId)
    expect(after.disciplineId).toBe(auflage)
    expect(after.standDisciplineId).toBeNull()
  })

  it("fremde, gelöschte und unbekannte Scheiben gibt es nicht", async () => {
    const { cardId } = await written(7_500)
    expect(
      await chooseCardDiscipline(db, { cardId, ownerId: other.ownerId, disciplineId: auflage })
    ).toBe("missing")
    expect(
      await chooseCardDiscipline(db, {
        cardId: "kein-schluessel",
        ownerId: site.ownerId,
        disciplineId: auflage,
      })
    ).toBe("missing")
    await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
    expect(
      await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
    ).toBe("missing")
    expect((await row(cardId)).disciplineId).toBe(site.disciplineId)
  })

  it("nur Disziplinen der Anlage mit demselben Scheibenbild, nicht ignoriert", async () => {
    const { cardId } = await written(7_600)
    for (const disciplineId of [rifle, ignored, other.disciplineId, 2_147_483_000])
      expect(await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId })).toBe(
        "notAllowed"
      )
    const after = await row(cardId)
    expect(after.disciplineId).toBe(site.disciplineId)
    expect(after.standDisciplineId).toBeNull()
  })
})

describe("disciplineOptions", () => {
  it("die wählbaren Disziplinen, die vom Stand und die aktuelle markiert", async () => {
    const { cardId } = await written(7_700)
    await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
    const options = await disciplineOptions(db, { cardId, ownerId: site.ownerId })
    expect(options.map((o) => o.id).sort((a, b) => a - b)).toEqual(
      [site.disciplineId, auflage].sort((a, b) => a - b)
    )
    expect(options.find((o) => o.id === site.disciplineId)).toMatchObject({
      name: "LP 40",
      stand: true,
      current: false,
    })
    expect(options.find((o) => o.id === auflage)).toMatchObject({
      name: "LP Auflage 30",
      stand: false,
      current: true,
    })
  })

  it("keine für eine fremde Scheibe und keine ohne Scheibenbild am Stand", async () => {
    const { cardId } = await written(7_800)
    expect(await disciplineOptions(db, { cardId, ownerId: other.ownerId })).toEqual([])
    await db.discipline.update({ where: { id: site.disciplineId }, data: { targetId: null } })
    try {
      expect(await disciplineOptions(db, { cardId, ownerId: site.ownerId })).toEqual([])
      expect(
        await chooseCardDiscipline(db, { cardId, ownerId: site.ownerId, disciplineId: auflage })
      ).toBe("notAllowed")
    } finally {
      await db.discipline.update({
        where: { id: site.disciplineId },
        data: { targetId: "lp-10m" },
      })
    }
  })
})
