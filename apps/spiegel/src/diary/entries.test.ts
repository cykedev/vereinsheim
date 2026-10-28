import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { formatIsoDate } from "@vereinsheim/lib/format"

import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../test/fixtures"

import {
  addCard,
  clearSection,
  createForCard,
  createFromEvening,
  createWithout,
  ENTRY_ERRORS,
  releaseCard,
  setBasics,
  setExecution,
  setExpected,
  setOutcome,
  setScale,
  setText,
  takeQuestion,
} from "./entries"
import { entryForCard, entryView, eveningEntries, newEntryView, threadView } from "./queries"
import { ERRORS } from "./texts"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
const DAY_MS = 86_400_000
let site: TestSite
let disciplineId: number
let otherId: string
let familySlug: string

beforeAll(async () => {
  site = await createTestSite(db, "diary-entries")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 20 Tagebuch",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
  familySlug = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).slug
  otherId = (
    await db.user.create({
      data: { email: `diary-entries-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

/** ein Abend: `daysAgo` Tage vor heute, um 19 Uhr in Berlin (17 Uhr UTC im Winter, nahe genug für den Abend) */
const eveningMs = (daysAgo: number, minute = 0) => {
  const day = formatIsoDate(new Date(Date.now() - daysAgo * DAY_MS), ZONE)
  return { day, ms: Date.parse(`${day}T17:${String(minute).padStart(2, "0")}:00Z`) }
}

async function card(startedAtMs: number, ownerId = site.ownerId) {
  const result = await writeEnteredCard(db, {
    ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs,
    kind: "training",
    details: {
      series: [
        { series: 1, shots: 10, rings: 90 },
        { series: 2, shots: 10, rings: 92 },
      ],
    },
    reason: "eingetragen",
  })
  if (result.kind !== "saved") throw new Error(result.kind)
  return result.cardId
}

const rowCount = () => db.diaryEntryCard.count({ where: { entry: { userId: site.ownerId } } })
const view = async (id: string) => (await entryView(db, site.ownerId, id, ZONE))!

describe("anlegen aus einem Abend", () => {
  it("verknüpft alle Scheiben des Abends und der Disziplin; ein zweites Mal geht nicht", async () => {
    const { day, ms } = eveningMs(3)
    const a = await card(ms)
    const b = await card(ms + 600_000)
    const foreign = await card(ms + 60_000, otherId)
    const created = await createFromEvening(db, site.ownerId, {
      day,
      familyId: site.familyId,
      timeZone: ZONE,
    })
    expect("id" in created).toBe(true)
    const id = (created as { id: string }).id
    const v = await view(id)
    expect(v.cards.linked.map((l) => l.id)).toEqual([a, b])
    expect(v.cards.linked.map((l) => l.card?.id)).toEqual([a, b])
    expect(v.cards.added).toEqual([])
    expect(JSON.stringify(v)).not.toContain(foreign)
    expect(v.series[a].map((s) => s.series)).toEqual([1, 2])
    expect(v.basicsEditable).toBe(false)
    expect(
      await createFromEvening(db, site.ownerId, { day, familyId: site.familyId, timeZone: ZONE })
    ).toEqual({
      error: ENTRY_ERRORS.taken,
    })
  })
})

describe("Scheiben vom selben Abend", () => {
  it("genau ein Eintrag: eine neue Scheibe ist dazugekommen, und Lesen schreibt nichts", async () => {
    const { day, ms } = eveningMs(5)
    const created = await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })
    const id = (created as { id: string }).id
    const later = await card(ms)
    const before = await rowCount()
    const v = await view(id)
    expect(v.cards.added.map((c) => c.id)).toEqual([later])
    expect(await rowCount()).toBe(before)
    expect(await entryForCard(db, site.ownerId, later, ZONE)).toEqual({ entryId: id, day })
    expect(
      (await eveningEntries(db, site.ownerId, [{ day, familySlug, cardIds: [later] }], ZONE)).get(
        `${day}|${familySlug}`
      )
    ).toEqual({ entryId: id })
  })

  it("zwei Einträge am selben Tag: die Scheibe wird in beiden nur angeboten", async () => {
    const { day, ms } = eveningMs(6)
    const first = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const second = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const c = await card(ms)
    for (const id of [first.id, second.id]) {
      const v = await view(id)
      expect(v.cards.added).toEqual([])
      expect(v.cards.offered.map((o) => o.id)).toEqual([c])
    }
    expect(await entryForCard(db, site.ownerId, c, ZONE)).toBeNull()
    expect(await addCard(db, site.ownerId, second.id, c, ZONE)).toBeNull()
    expect((await view(second.id)).cards.linked.map((l) => l.id)).toEqual([c])
    expect((await view(first.id)).cards.offered).toEqual([])
  })

  it("eine gelöste Scheibe kommt nicht wieder und wechselt von Hand in einen anderen Eintrag, ihre Zeile wird aktualisiert", async () => {
    const { day, ms } = eveningMs(7)
    const c = await card(ms)
    const a = (await createFromEvening(db, site.ownerId, {
      day,
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    expect(
      await setExecution(db, site.ownerId, a.id, { cardId: c, series: 1, stage: 4, timeZone: ZONE })
    ).toBeNull()
    expect(await releaseCard(db, site.ownerId, a.id, c)).toBeNull()
    expect(await db.diarySeriesExecution.count({ where: { entryId: a.id } })).toBe(0)
    const released = await view(a.id)
    expect(released.cards.linked).toEqual([])
    expect(released.cards.added).toEqual([])
    expect(released.cards.offered.map((o) => o.id)).toEqual([c])
    const b = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    expect(await addCard(db, site.ownerId, b.id, c, ZONE)).toBeNull()
    const rows = await db.diaryEntryCard.findMany({ where: { cardId: c } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ entryId: b.id, link: "linked" })
    expect(await addCard(db, site.ownerId, a.id, c, ZONE)).toBe(ENTRY_ERRORS.taken)
  })

  it("nimmt keine Scheibe eines anderen Abends oder Kontos", async () => {
    const { day } = eveningMs(8)
    const { ms: otherDay } = eveningMs(9)
    const e = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    expect(await addCard(db, site.ownerId, e.id, await card(otherDay), ZONE)).toBe(
      ENTRY_ERRORS.notHere
    )
    expect(await addCard(db, site.ownerId, e.id, await card(otherDay, otherId), ZONE)).toBe(
      ENTRY_ERRORS.noCard
    )
  })

  it("löst keine fremde Scheibe: keine Zeile, eine fremde Zeile bleibt", async () => {
    const { day, ms } = eveningMs(9)
    const e = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const foreign = await card(ms, otherId)
    expect(await releaseCard(db, site.ownerId, e.id, foreign, ZONE)).toBe(ENTRY_ERRORS.noCard)
    expect(await db.diaryEntryCard.count({ where: { cardId: foreign } })).toBe(0)
    const theirs = await db.diaryEntry.create({
      data: { userId: otherId, day: new Date(`${day}T00:00:00.000Z`), familyId: site.familyId },
    })
    await db.diaryEntryCard.create({
      data: { cardId: foreign, entryId: theirs.id, link: "released" },
    })
    expect(await releaseCard(db, site.ownerId, e.id, foreign, ZONE)).toBe(ENTRY_ERRORS.noCard)
    expect(await db.diaryEntryCard.findUnique({ where: { cardId: foreign } })).toMatchObject({
      entryId: theirs.id,
    })
    await db.diaryEntry.delete({ where: { id: theirs.id } })
  })
})

describe("Werte eines Eintrags", () => {
  let id: string
  let c: string
  beforeAll(async () => {
    const { day, ms } = eveningMs(10)
    c = await card(ms)
    id = (
      (await createFromEvening(db, site.ownerId, {
        day,
        familyId: site.familyId,
        timeZone: ZONE,
      })) as { id: string }
    ).id
  })

  it("speichert die Mitte der Stufe, lässt einen genauen Wert derselben Stufe stehen und nimmt ihn mit null weg", async () => {
    expect(
      await setScale(db, site.ownerId, id, { part: "wellbeing", aspect: "sleep", stage: 3 })
    ).toBeNull()
    const value = () =>
      db.diaryScale.findUnique({
        where: { entryId_part_aspect: { entryId: id, part: "wellbeing", aspect: "sleep" } },
      })
    expect((await value())?.value).toBe(50)
    await db.diaryScale.update({
      where: { entryId_part_aspect: { entryId: id, part: "wellbeing", aspect: "sleep" } },
      data: { value: 43 },
    })
    expect(
      await setScale(db, site.ownerId, id, { part: "wellbeing", aspect: "sleep", stage: 3 })
    ).toBeNull()
    expect((await value())?.value).toBe(43)
    expect(
      await setScale(db, site.ownerId, id, { part: "wellbeing", aspect: "sleep", stage: 4 })
    ).toBeNull()
    expect((await value())?.value).toBe(70)
    expect(
      await setScale(db, site.ownerId, id, { part: "wellbeing", aspect: "sleep", stage: null })
    ).toBeNull()
    expect(await value()).toBeNull()
  })

  it("nimmt nur Aspekte aus der festen Liste je Teil", async () => {
    expect(
      await setScale(db, site.ownerId, id, { part: "wellbeing", aspect: "technique", stage: 3 })
    ).toBe(ERRORS.failed)
    expect(
      await setScale(db, site.ownerId, id, { part: "feedback", aspect: "sleep", stage: 3 })
    ).toBe(ERRORS.failed)
    expect(
      await db.diaryScale.count({ where: { entryId: id, aspect: "technique", part: "wellbeing" } })
    ).toBe(0)
  })

  it("bewertet nur Serien, die die Scheibe hat", async () => {
    expect(
      await setExecution(db, site.ownerId, id, { cardId: c, series: 2, stage: 5, timeZone: ZONE })
    ).toBeNull()
    expect(
      await setExecution(db, site.ownerId, id, { cardId: c, series: 3, stage: 5, timeZone: ZONE })
    ).toBe(ENTRY_ERRORS.series)
    expect((await view(id)).executions).toEqual([{ cardId: c, series: 2, value: 90 }])
  })

  it("speichert Texte, das erwartete Ergebnis und die Antwort", async () => {
    expect(await setText(db, site.ownerId, id, "note", "- Griff\n- Atmung")).toBeNull()
    expect(await setText(db, site.ownerId, id, "intention", "Ruhe im Kopf")).toBeNull()
    expect(await setText(db, site.ownerId, id, "learned", "x".repeat(2001))).toBe(
      ENTRY_ERRORS.tooLong
    )
    expect(await setExpected(db, site.ownerId, id, "340,5")).toBeNull()
    expect(await setExpected(db, site.ownerId, id, "340,55")).toBe(ENTRY_ERRORS.expected)
    expect(await setOutcome(db, site.ownerId, id, "partly")).toBeNull()
    expect(await setOutcome(db, site.ownerId, id, "vielleicht")).toBe(ERRORS.failed)
    const v = await view(id)
    expect([v.note, v.intention, v.expectedScore, v.outcome]).toEqual([
      "- Griff\n- Atmung",
      "Ruhe im Kopf",
      340.5,
      "partly",
    ])
    expect(await setText(db, site.ownerId, id, "note", "   ")).toBeNull()
    expect((await view(id)).note).toBeNull()
  })

  it("leert einen Abschnitt", async () => {
    await setScale(db, site.ownerId, id, { part: "prognosis", aspect: "technique", stage: 4 })
    expect(await clearSection(db, site.ownerId, id, "prognosis")).toBeNull()
    const v = await view(id)
    expect(v.scales.filter((s) => s.part === "prognosis")).toEqual([])
    expect(v.expectedScore).toBeNull()
  })

  it("ändert Tag, Art und Disziplin nicht, solange Scheiben dazugehören", async () => {
    const { day } = eveningMs(11)
    expect(
      await setBasics(db, site.ownerId, id, { day, kind: "dry", familyId: null, timeZone: ZONE })
    ).toBe(ENTRY_ERRORS.hasCards)
  })

  it("gibt einem anderen Konto nichts", async () => {
    expect(await setText(db, otherId, id, "note", "fremd")).toBe(ERRORS.missing)
    expect(await entryView(db, otherId, id, ZONE)).toBeNull()
  })
})

describe("ohne Scheibe", () => {
  it("braucht bei „Mit Scheiben“ eine Disziplin und nimmt keinen Tag in der Zukunft", async () => {
    const tomorrow = formatIsoDate(new Date(Date.now() + 2 * DAY_MS), ZONE)
    const { day } = eveningMs(12)
    expect(
      await createWithout(db, site.ownerId, {
        day,
        kind: "shooting",
        familyId: null,
        timeZone: ZONE,
      })
    ).toEqual({ error: ENTRY_ERRORS.family })
    expect(
      await createWithout(db, site.ownerId, {
        day: tomorrow,
        kind: "mental",
        familyId: null,
        timeZone: ZONE,
      })
    ).toEqual({ error: ENTRY_ERRORS.future })
    const mental = (await createWithout(db, site.ownerId, {
      day,
      kind: "mental",
      familyId: null,
      timeZone: ZONE,
    })) as { id: string }
    expect(
      await setBasics(db, site.ownerId, mental.id, {
        day,
        kind: "dry",
        familyId: site.familyId,
        timeZone: ZONE,
      })
    ).toBeNull()
    expect((await view(mental.id)).kind).toBe("dry")
  })
})

describe("der Faden", () => {
  it("die letzte Frage derselben Disziplin aus einem früheren Eintrag, nicht aus dem Papierkorb; neueste oben", async () => {
    const old = (await createWithout(db, site.ownerId, {
      day: eveningMs(40).day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const deleted = (await createWithout(db, site.ownerId, {
      day: eveningMs(39).day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const next = (await createWithout(db, site.ownerId, {
      day: eveningMs(38).day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    await setText(db, site.ownerId, old.id, "question", "früher diese Ruhe zu finden?")
    await setText(db, site.ownerId, old.id, "learned", "ich ab der zweiten Serie ruhiger bin.")
    await setText(db, site.ownerId, deleted.id, "question", "das hier zu sehen?")
    await db.diaryEntry.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
    expect((await view(next.id)).thread).toMatchObject({
      entryId: old.id,
      question: "früher diese Ruhe zu finden?",
    })
    expect(await takeQuestion(db, site.ownerId, next.id)).toBeNull()
    expect((await view(next.id)).intention).toBe("Wie schaffe ich es, früher diese Ruhe zu finden?")
    await setText(db, site.ownerId, next.id, "question", "das öfter zu schaffen?")
    const thread = await threadView(db, site.ownerId, familySlug)
    expect(thread.family?.id).toBe(site.familyId)
    expect(thread.items.map((i) => i.entryId).slice(0, 2)).toEqual([next.id, old.id])
    expect(thread.items.some((i) => i.entryId === deleted.id)).toBe(false)
  })
})

describe("Anlegen an einer Scheibe und der Schusstag", () => {
  it("„Eintrag anlegen“ legt direkt an, ein zweites Mal kommt derselbe Eintrag", async () => {
    const { ms } = eveningMs(13)
    const c = await card(ms)
    const first = (await createForCard(db, site.ownerId, c, ZONE)) as { id: string }
    expect(first.id).toBeTruthy()
    expect(await createForCard(db, site.ownerId, c, ZONE)).toEqual({ id: first.id })
    expect((await view(first.id)).cards.linked.map((x) => x.card?.id)).toEqual([c])
    expect(await createForCard(db, site.ownerId, await card(ms, otherId), ZONE)).toEqual({
      error: ENTRY_ERRORS.noCard,
    })
  })

  it("eine Scheibe kommt in den Eintrag ihres Schusstags, nicht in den des Eingangs", async () => {
    // ein Eintrag für heute und einer für den Tag vor zwölf Tagen; die Scheibe kommt heute an, geschossen damals
    const today = formatIsoDate(new Date(), ZONE)
    const { day, ms } = eveningMs(14)
    const now = (await createWithout(db, site.ownerId, {
      day: today,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const then = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const c = await card(ms)
    expect((await view(then.id)).cards.added.map((x) => x.id)).toContain(c)
    expect((await view(now.id)).cards.added.map((x) => x.id)).not.toContain(c)
    await db.diaryEntry.deleteMany({ where: { id: { in: [now.id, then.id] } } })
  })
})

describe("Vorschläge", () => {
  it("nur Abende ohne Eintrag dieser Disziplin, die Scheibe aus der Adresse markiert", async () => {
    const { day, ms } = eveningMs(1)
    const c = await card(ms)
    const before = await newEntryView(db, site.ownerId, ZONE, c)
    const mine = before.proposals.find((p) => p.day === day && p.family.id === site.familyId)
    expect(mine?.cards.map((x) => x.id)).toEqual([c])
    expect(mine?.marked).toBe(true)
    await createFromEvening(db, site.ownerId, { day, familyId: site.familyId, timeZone: ZONE })
    const after = await newEntryView(db, site.ownerId, ZONE, null)
    expect(after.proposals.some((p) => p.day === day && p.family.id === site.familyId)).toBe(false)
  })
  it("jeder Abend ohne Eintrag steht, egal wie alt, neueste zuerst", async () => {
    const { day, ms } = eveningMs(45)
    const c = await card(ms)
    const old = await card(eveningMs(400).ms)
    const view = await newEntryView(db, site.ownerId, ZONE, null)
    const mine = view.proposals.filter((p) => p.family.id === site.familyId)
    expect(mine.some((p) => p.day === day)).toBe(true)
    expect(mine.some((p) => p.cards.some((x) => x.id === old))).toBe(true)
    expect(mine.map((p) => p.day)).toEqual([...mine.map((p) => p.day)].sort().reverse())
    expect(
      (await newEntryView(db, site.ownerId, ZONE, c)).proposals.find((p) => p.day === day)
    ).toMatchObject({ marked: true })
  })
})
