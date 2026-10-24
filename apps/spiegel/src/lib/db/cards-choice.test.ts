import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { generateSeason, type GeneratedCard } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { chooseCardDiscipline, writeRevision } from "./cards"
import { disciplineOptions } from "./reads"

// Die Disziplin einer Scheibe wählt der Schütze; jeder spätere Stand aus Meyton mit derselben Disziplin lässt die Wahl
// stehen und schreibt nur die Disziplin am Stand (`standDisciplineId`).

const db = createPrismaClient()
let site: TestSite
let other: TestSite
/** dasselbe Scheibenbild, andere Familie, eingeordnet; Wertung Zehntel */
let auflage: number
let auflageFamily: number
/** dasselbe Scheibenbild und dieselbe Familie wie die vom Stand, eingeordnet */
let lp60: number
/** anderes Scheibenbild */
let rifle: number
/** dasselbe Scheibenbild, vom Admin ignoriert */
let ignored: number
/** dasselbe Scheibenbild, noch nicht eingeordnet (nur ein Vorschlag des Einlesens) */
let unconfirmed: number
/** dasselbe Scheibenbild, eingeordnet, aber ohne Familie */
let familyless: number

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

const matchShots = (card: GeneratedCard) => card.shots.filter((s) => s.stellung !== 0).length

/** eine Scheibe mit Wertung unter 40 Schuss, geschrieben wie vom Einlesen */
async function written(scheibenIdBase: number, ownerId = site.ownerId) {
  const card = season(scheibenIdBase, ownerId).find((c) => {
    const match = matchShots(c)
    return match > 1 && match < 40
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
      currentRevision: { select: { number: true } },
    },
  })
const choose = (cardId: string, disciplineId: number, ownerId = site.ownerId) =>
  chooseCardDiscipline(db, { cardId, ownerId, disciplineId })
const discipline = (data: {
  meytonId: number
  name: string
  targetId: "lp-10m" | "lg-10m"
  familyId?: number | null
  confirmed?: boolean
  ignored?: boolean
  officialScoring?: "decimal" | "rings"
}) =>
  db.discipline
    .create({
      data: {
        siteId: site.siteId,
        meytonId: data.meytonId,
        name: data.name,
        targetId: data.targetId,
        familyId: data.familyId ?? null,
        officialScoring: data.officialScoring ?? null,
        confirmedAt: data.confirmed === false ? null : new Date(),
        ignoredAt: data.ignored ? new Date() : null,
      },
    })
    .then((d) => d.id)

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
  auflage = await discipline({
    meytonId: 10_211_030,
    name: "LP Auflage 30",
    targetId: "lp-10m",
    familyId: auflageFamily,
    officialScoring: "decimal",
  })
  lp60 = await discipline({
    meytonId: 10_210_060,
    name: "LP 60",
    targetId: "lp-10m",
    familyId: site.familyId,
  })
  rifle = await discipline({
    meytonId: 10_110_040,
    name: "LG 40",
    targetId: "lg-10m",
    familyId: site.familyId,
  })
  ignored = await discipline({
    meytonId: 10_299_000,
    name: "LP Spiel",
    targetId: "lp-10m",
    familyId: site.familyId,
    ignored: true,
  })
  unconfirmed = await discipline({
    meytonId: 10_299_001,
    name: "LP Vorschlag",
    targetId: "lp-10m",
    familyId: site.familyId,
    confirmed: false,
  })
  familyless = await discipline({ meytonId: 10_299_002, name: "LP ohne", targetId: "lp-10m" })
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
    await db.discipline.update({ where: { id: auflage }, data: { plannedShots: matchShots(card) } })
    expect(await choose(cardId, auflage)).toBe("saved")
    const after = await row(cardId)
    expect(after).toMatchObject({
      disciplineId: auflage,
      standDisciplineId: site.disciplineId,
      familyId: auflageFamily,
    })
    expect(after.flags).not.toContain("unvollstaendig")
    const { version } = await db.discipline.findUniqueOrThrow({ where: { id: auflage } })
    expect(after.disciplineVersion).toBe(version)
  })

  it("ein neuer Stand mit derselben Disziplin lässt die Wahl stehen, rechnet mit ihr und ist keine Korrektur", async () => {
    const { cardId, card } = await written(7_200)
    await db.discipline.update({ where: { id: auflage }, data: { plannedShots: matchShots(card) } })
    await choose(cardId, auflage)
    const before = await row(cardId)
    const result = await again(card, Date.now())
    expect(result).toMatchObject({ cardId, change: "unchanged" })
    const after = await row(cardId)
    expect(after).toMatchObject({
      disciplineId: auflage,
      standDisciplineId: site.disciplineId,
      familyId: auflageFamily,
    })
    expect(after.currentRevision?.number).toBe(before.currentRevision?.number)
    // der Adapter schickt „unvollständig“ nach LP 40; gerechnet wird mit der gewählten Schusszahl
    expect(after.flags).not.toContain("unvollstaendig")
    expect(after.flags).not.toContain("korrigiert")
  })

  it("eine Korrektur der Wertung unter einer Wahl: neue Revision, die Wahl bleibt", async () => {
    const { cardId, card } = await written(7_250)
    await choose(cardId, auflage)
    const i = card.shots.findIndex((s) => s.stellung !== 0 && (s.decimalTenths ?? 0) > 20)
    const corrected = {
      ...card,
      shots: card.shots.map((s, j) =>
        j === i ? { ...s, decimalTenths: (s.decimalTenths as number) - 10 } : s
      ),
    }
    const result = await again(corrected, Date.now())
    expect(result.change).toBe("created")
    expect(await row(cardId)).toMatchObject({
      disciplineId: auflage,
      standDisciplineId: site.disciplineId,
      familyId: auflageFamily,
    })
  })

  it("die Disziplin vom Stand wieder wählen hebt die Wahl auf", async () => {
    const { cardId } = await written(7_300)
    await choose(cardId, auflage)
    expect(await choose(cardId, site.disciplineId)).toBe("saved")
    const after = await row(cardId)
    expect(after).toMatchObject({
      disciplineId: site.disciplineId,
      standDisciplineId: null,
      familyId: site.familyId,
    })
    expect(after.flags).toContain("unvollstaendig")
  })

  it("bringt Meyton später die gewählte oder eine dritte Disziplin, gilt wieder die vom Stand", async () => {
    const chosenLater = await written(7_400)
    await choose(chosenLater.cardId, auflage)
    await again(chosenLater.card, Date.now(), auflage)
    expect(await row(chosenLater.cardId)).toMatchObject({
      disciplineId: auflage,
      standDisciplineId: null,
      familyId: auflageFamily,
    })

    const third = await written(7_450)
    await choose(third.cardId, auflage)
    await again(third.card, Date.now(), lp60)
    expect(await row(third.cardId)).toMatchObject({
      disciplineId: lp60,
      standDisciplineId: null,
      familyId: site.familyId,
    })
  })

  it("fremde, gelöschte, wartende und unbekannte Scheiben gibt es nicht", async () => {
    const { cardId } = await written(7_500)
    expect(await choose(cardId, auflage, other.ownerId)).toBe("missing")
    expect(await choose("kein-schluessel", auflage)).toBe("missing")
    await db.card.update({ where: { id: cardId }, data: { ownerPending: true } })
    expect(await choose(cardId, auflage)).toBe("missing")
    await db.card.update({
      where: { id: cardId },
      data: { ownerPending: false, deletedAt: new Date() },
    })
    expect(await choose(cardId, auflage)).toBe("missing")
    expect((await row(cardId)).disciplineId).toBe(site.disciplineId)
  })

  it("nur eingeordnete Disziplinen der Anlage mit Familie und demselben Scheibenbild, nicht ignoriert", async () => {
    const { cardId } = await written(7_600)
    for (const disciplineId of [
      rifle,
      ignored,
      unconfirmed,
      familyless,
      other.disciplineId,
      2_147_483_000,
    ])
      expect(await choose(cardId, disciplineId)).toBe("notAllowed")
    expect(await row(cardId)).toMatchObject({
      disciplineId: site.disciplineId,
      standDisciplineId: null,
    })
  })
})

describe("disciplineOptions", () => {
  it("die wählbaren Disziplinen, die vom Stand und die aktuelle markiert, je mit der Wertung danach", async () => {
    const { cardId } = await written(7_700)
    await choose(cardId, auflage)
    const options = await disciplineOptions(db, { cardId, ownerId: site.ownerId })
    expect(options.map((o) => o.id).sort((a, b) => a - b)).toEqual(
      [site.disciplineId, auflage, lp60].sort((a, b) => a - b)
    )
    expect(options.find((o) => o.id === site.disciplineId)).toMatchObject({
      name: "LP 40",
      stand: true,
      current: false,
      scoring: "rings",
    })
    expect(options.find((o) => o.id === auflage)).toMatchObject({
      name: "LP Auflage 30",
      stand: false,
      current: true,
      scoring: "decimal",
    })
  })

  it("eine eigene Wahl der Wertung bleibt bei jeder Disziplin", async () => {
    const { cardId } = await written(7_750)
    await db.card.update({ where: { id: cardId }, data: { scoringChoice: "rings" } })
    const options = await disciplineOptions(db, { cardId, ownerId: site.ownerId })
    expect(options.every((o) => o.scoring === "rings")).toBe(true)
  })

  it("ignoriert der Admin die Disziplin vom Stand, geht es nicht mehr zurück (die Scheibe verschwände)", async () => {
    const { cardId } = await written(7_800)
    await choose(cardId, auflage)
    await db.discipline.update({
      where: { id: site.disciplineId },
      data: { ignoredAt: new Date() },
    })
    try {
      const options = await disciplineOptions(db, { cardId, ownerId: site.ownerId })
      expect(options.map((o) => o.id)).not.toContain(site.disciplineId)
      expect(await choose(cardId, site.disciplineId)).toBe("notAllowed")
    } finally {
      await db.discipline.update({ where: { id: site.disciplineId }, data: { ignoredAt: null } })
    }
  })

  it("keine für eine fremde Scheibe; ohne Scheibenbild am Stand nur zurück", async () => {
    const { cardId } = await written(7_900)
    expect(await disciplineOptions(db, { cardId, ownerId: other.ownerId })).toEqual([])
    await db.discipline.update({ where: { id: site.disciplineId }, data: { targetId: null } })
    try {
      expect(
        (await disciplineOptions(db, { cardId, ownerId: site.ownerId })).map((o) => o.id)
      ).toEqual([site.disciplineId])
      expect(await choose(cardId, auflage)).toBe("notAllowed")
    } finally {
      await db.discipline.update({
        where: { id: site.disciplineId },
        data: { targetId: "lp-10m" },
      })
    }
  })
})
