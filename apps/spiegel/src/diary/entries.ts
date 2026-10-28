// Was der Schütze an einem Eintrag ändert: anlegen, Scheiben dazunehmen und lösen, Texte, Stufen, Abschnitte leeren.
// Jede Funktion prüft das eigene Konto und den Eintrag (nicht im Papierkorb) selbst; Prüfen und Schreiben stehen in
// einer Transaktion (conventions §9). Rückgabe: null bei Erfolg, sonst der Grund in Worten.

import { formatIsoDate } from "@vereinsheim/lib/format"

import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"
import { resultCardSeries, resultCards, resultFamilies } from "@/lib/results-read"

import { entryCards, type CardLinkRow } from "./cards"
import { lastQuestion } from "./queries"
import { isAspectOf, stageOf, valueOfStage, type ScalePart, type Stage } from "./scales"
import { ERRORS } from "./texts"
import {
  dateOfDay,
  dayInput,
  dayOfDate,
  kindInput,
  outcomeInput,
  parseExpectedScore,
  textInput,
  type TextField,
} from "./validation"

type Tx = Prisma.TransactionClient

export const ENTRY_ERRORS = {
  taken: "Diese Scheiben stecken schon in einem Eintrag. Lade die Seite neu.",
  family: "Bitte eine Disziplin wählen.",
  future: "Dieser Tag liegt in der Zukunft.",
  noCard: "Diese Scheibe gibt es nicht mehr.",
  notHere: "Diese Scheibe gehört nicht zu diesem Abend.",
  hasCards: "Tag, Art und Disziplin kommen von den Scheiben.",
  expected: "Bitte ein Ergebnis wie 340 oder 340,5.",
  tooLong: "Höchstens 2.000 Zeichen.",
  series: "Diese Serie gibt es an der Scheibe nicht.",
} as const

const serializable = { isolationLevel: "Serializable" as const }

/** der eigene Eintrag, nicht im Papierkorb, gesperrt für diese Transaktion; sonst null */
async function lockEntry(tx: Tx, userId: string, entryId: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "DiaryEntry" WHERE id = ${entryId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
  if (!row) return null
  return tx.diaryEntry.findUniqueOrThrow({
    where: { id: entryId },
    select: { id: true, day: true, familyId: true, kind: true, intention: true },
  })
}

/** Rahmen jeder Änderung: Transaktion, ein Fehler der Datenbank als Text */
async function run(db: Db, change: (tx: Tx) => Promise<string | null>): Promise<string | null> {
  try {
    return await db.$transaction(change, serializable)
  } catch {
    return ERRORS.failed
  }
}

/** die Scheiben des Kontos, die zum Abend und zur Disziplin eines Eintrags gehören könnten, und ihre Zeilen */
async function eveningOf(
  db: Db,
  userId: string,
  day: string,
  familyId: number | null,
  timeZone: string
) {
  const cards = (await resultCards(db, { ownerId: userId, timeZone })).filter(
    (card) => card.day === day && card.family !== null && card.family.id === familyId
  )
  const [entries, links] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, day: dateOfDay(day), familyId },
      select: { id: true, day: true, familyId: true, deletedAt: true },
    }),
    db.diaryEntryCard.findMany({
      where: { cardId: { in: cards.map((c) => c.id) } },
      select: { cardId: true, entryId: true, link: true },
    }),
  ])
  return {
    cards,
    entries: entries.map((e) => ({
      id: e.id,
      day: dayOfDate(e.day),
      familyId: e.familyId,
      deleted: e.deletedAt !== null,
    })),
    links: links as CardLinkRow[],
  }
}

/**
 * Ein Eintrag aus dem Vorschlag eines Abends: verknüpft alle Scheiben dieses Abends und dieser Disziplin, die in
 * keinem Eintrag fest stecken. Gibt es für den Abend schon einen Eintrag dieser Disziplin, oder steckt jede Scheibe
 * schon fest, geht es nicht.
 */
export async function createFromEvening(
  db: Db,
  userId: string,
  input: { day: string; familyId: number; timeZone: string }
): Promise<{ id: string } | { error: string }> {
  if (!dayInput.safeParse(input.day).success) return { error: ERRORS.failed }
  const { cards } = await eveningOf(db, userId, input.day, input.familyId, input.timeZone)
  if (!cards.length) return { error: ENTRY_ERRORS.taken }
  let id: string | null = null
  const error = await run(db, async (tx) => {
    const open = await tx.diaryEntry.count({
      where: { userId, day: dateOfDay(input.day), familyId: input.familyId, deletedAt: null },
    })
    if (open > 0) return ENTRY_ERRORS.taken
    const rows = await tx.diaryEntryCard.findMany({
      where: { cardId: { in: cards.map((c) => c.id) } },
      select: { cardId: true, link: true },
    })
    const fixed = new Set(rows.filter((r) => r.link === "linked").map((r) => r.cardId))
    const free = cards.filter((card) => !fixed.has(card.id))
    if (!free.length) return ENTRY_ERRORS.taken
    const entry = await tx.diaryEntry.create({
      data: { userId, day: dateOfDay(input.day), kind: "shooting", familyId: input.familyId },
      select: { id: true },
    })
    for (const card of free)
      await tx.diaryEntryCard.upsert({
        where: { cardId: card.id },
        create: { cardId: card.id, entryId: entry.id, link: "linked" },
        update: { entryId: entry.id, link: "linked" },
      })
    id = entry.id
    return null
  })
  return error ? { error } : { id: id! }
}

/** ein Eintrag ohne Scheibe: Trocken- oder Mentaltraining, oder vor einem Wettkampf; bei „Mit Scheiben“ mit Disziplin */
export async function createWithout(
  db: Db,
  userId: string,
  input: { day: string; kind: string; familyId: number | null; timeZone: string }
): Promise<{ id: string } | { error: string }> {
  const basics = await checkBasics(db, userId, input)
  if ("error" in basics) return basics
  try {
    const entry = await db.diaryEntry.create({
      data: { userId, day: dateOfDay(basics.day), kind: basics.kind, familyId: basics.familyId },
      select: { id: true },
    })
    return { id: entry.id }
  } catch {
    return { error: ERRORS.failed }
  }
}

/** Tag, Art und Disziplin prüfen: Tag nicht in der Zukunft, Disziplin eine anbietbare, bei „Mit Scheiben“ Pflicht */
async function checkBasics(
  db: Db,
  userId: string,
  input: { day: string; kind: string; familyId: number | null; timeZone: string }
): Promise<
  { day: string; kind: "shooting" | "dry" | "mental"; familyId: number | null } | { error: string }
> {
  const kind = kindInput.safeParse(input.kind)
  if (!kind.success || !dayInput.safeParse(input.day).success) return { error: ERRORS.failed }
  if (input.day > formatIsoDate(new Date(), input.timeZone)) return { error: ENTRY_ERRORS.future }
  if (input.familyId === null) {
    if (kind.data === "shooting") return { error: ENTRY_ERRORS.family }
  } else if (!(await resultFamilies(db, userId)).some((f) => f.id === input.familyId)) {
    return { error: ENTRY_ERRORS.family }
  }
  return { day: input.day, kind: kind.data, familyId: input.familyId }
}

/** Tag, Art und Disziplin ändern, nur solange keine Scheibe zum Eintrag gehört */
export async function setBasics(
  db: Db,
  userId: string,
  entryId: string,
  input: { day: string; kind: string; familyId: number | null; timeZone: string }
): Promise<string | null> {
  const basics = await checkBasics(db, userId, input)
  if ("error" in basics) return basics.error
  const current = await db.diaryEntry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    select: { day: true, familyId: true },
  })
  if (!current) return ERRORS.missing
  const { entries, links, cards } = await eveningOf(
    db,
    userId,
    dayOfDate(current.day),
    current.familyId,
    input.timeZone
  )
  const set = entryCards(
    entries,
    links,
    cards.map((c) => ({ id: c.id, day: c.day, familyId: c.family!.id }))
  )
  const own = set.get(entryId)
  const fixed = await db.diaryEntryCard.count({ where: { entryId, link: "linked" } })
  if (fixed > 0 || (own && own.added.length > 0)) return ENTRY_ERRORS.hasCards
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    await tx.diaryEntry.update({
      where: { id: entryId },
      data: { day: dateOfDay(basics.day), kind: basics.kind, familyId: basics.familyId },
    })
    return null
  })
}

/**
 * Eine Scheibe von Hand in den Eintrag nehmen: nur eine eigene vom selben Abend und derselben Disziplin, die nicht
 * fest in einem anderen Eintrag steckt. Eine gelöste oder dazugekommene Scheibe bekommt ihre Zeile (`linked`); die
 * Zeile einer gelösten wird aktualisiert, nicht doppelt angelegt.
 */
export async function addCard(
  db: Db,
  userId: string,
  entryId: string,
  cardId: string,
  timeZone: string
): Promise<string | null> {
  const [card] = await resultCards(db, { ownerId: userId, timeZone, ids: [cardId] })
  if (!card) return ENTRY_ERRORS.noCard
  return run(db, async (tx) => {
    const entry = await lockEntry(tx, userId, entryId)
    if (!entry) return ERRORS.missing
    if (
      dayOfDate(entry.day) !== card.day ||
      entry.familyId === null ||
      card.family?.id !== entry.familyId
    )
      return ENTRY_ERRORS.notHere
    const row = await tx.diaryEntryCard.findUnique({ where: { cardId } })
    if (row?.link === "linked" && row.entryId !== entryId) {
      const other = await tx.diaryEntry.findUnique({
        where: { id: row.entryId },
        select: { deletedAt: true },
      })
      if (other) return ENTRY_ERRORS.taken
    }
    await tx.diaryEntryCard.upsert({
      where: { cardId },
      create: { cardId, entryId, link: "linked" },
      update: { entryId, link: "linked" },
    })
    return null
  })
}

/**
 * Eine Scheibe aus dem Eintrag lösen (auch eine dazugekommene oder eine, die es nicht mehr gibt): Zeile `released`, die
 * Ausführung ihrer Serien in diesem Eintrag geht mit
 */
export async function releaseCard(
  db: Db,
  userId: string,
  entryId: string,
  cardId: string
): Promise<string | null> {
  if (typeof cardId !== "string" || !cardId || cardId.length > 64) return ENTRY_ERRORS.noCard
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    const row = await tx.diaryEntryCard.findUnique({ where: { cardId } })
    if (row && row.entryId !== entryId && row.link === "linked") return ENTRY_ERRORS.notHere
    await tx.diaryEntryCard.upsert({
      where: { cardId },
      create: { cardId, entryId, link: "released" },
      update: { entryId, link: "released" },
    })
    await tx.diarySeriesExecution.deleteMany({ where: { entryId, cardId } })
    return null
  })
}

/** ein Textfeld speichern; leer heißt kein Wert */
export async function setText(
  db: Db,
  userId: string,
  entryId: string,
  field: TextField,
  raw: string
): Promise<string | null> {
  const parsed = textInput.safeParse(typeof raw === "string" ? raw : "")
  if (!parsed.success) return ENTRY_ERRORS.tooLong
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    await tx.diaryEntry.update({ where: { id: entryId }, data: { [field]: parsed.data } })
    return null
  })
}

/** das erwartete Ergebnis der Prognose */
export async function setExpected(
  db: Db,
  userId: string,
  entryId: string,
  raw: string
): Promise<string | null> {
  const value = parseExpectedScore(typeof raw === "string" ? raw : "")
  if (value === undefined) return ENTRY_ERRORS.expected
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    await tx.diaryEntry.update({ where: { id: entryId }, data: { expectedScore: value } })
    return null
  })
}

/** „Hat es geklappt?“; null nimmt die Antwort zurück */
export async function setOutcome(
  db: Db,
  userId: string,
  entryId: string,
  outcome: string | null
): Promise<string | null> {
  const parsed = outcomeInput.safeParse(outcome)
  if (!parsed.success) return ERRORS.failed
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    await tx.diaryEntry.update({ where: { id: entryId }, data: { outcome: parsed.data } })
    return null
  })
}

const isStage = (value: unknown): value is Stage =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5

/**
 * Eine Stufe tippen: speichert ihre Mitte. Steht schon ein Wert in dieser Stufe (auch ein genauer aus Treffsicher),
 * bleibt er. `null` nimmt den Wert weg (der Tipp auf die gezeigte Stufe).
 */
export async function setScale(
  db: Db,
  userId: string,
  entryId: string,
  input: { part: ScalePart; aspect: string; stage: Stage | null }
): Promise<string | null> {
  const { part, aspect, stage } = input
  if (!["wellbeing", "prognosis", "feedback"].includes(part) || !isAspectOf(part, aspect))
    return ERRORS.failed
  if (stage !== null && !isStage(stage)) return ERRORS.failed
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    const where = { entryId_part_aspect: { entryId, part, aspect } }
    if (stage === null) {
      await tx.diaryScale.deleteMany({ where: { entryId, part, aspect } })
      return null
    }
    const current = await tx.diaryScale.findUnique({ where })
    if (current && stageOf(current.value) === stage) return null
    await tx.diaryScale.upsert({
      where,
      create: { entryId, part, aspect, value: valueOfStage(stage) },
      update: { value: valueOfStage(stage) },
    })
    return null
  })
}

/**
 * Die Ausführung einer Serie tippen, nur für eine Scheibe, die zum Eintrag gehört, und eine Serie, die sie hat; wie
 * `setScale` bleibt ein Wert in derselben Stufe, `null` nimmt ihn weg
 */
export async function setExecution(
  db: Db,
  userId: string,
  entryId: string,
  input: { cardId: string; series: number; stage: Stage | null; timeZone: string }
): Promise<string | null> {
  const { cardId, series, stage } = input
  if (stage !== null && !isStage(stage)) return ERRORS.failed
  const entry = await db.diaryEntry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    select: { day: true, familyId: true },
  })
  if (!entry) return ERRORS.missing
  const { entries, links, cards } = await eveningOf(
    db,
    userId,
    dayOfDate(entry.day),
    entry.familyId,
    input.timeZone
  )
  const set = entryCards(
    entries,
    links,
    cards.map((c) => ({ id: c.id, day: c.day, familyId: c.family!.id }))
  )
  const own = set.get(entryId)
  if (!own || ![...own.linked, ...own.added].includes(cardId)) return ENTRY_ERRORS.notHere
  const known = await resultCardSeries(db, { ownerId: userId, cardId })
  if (!known?.some((s) => s.series === series)) return ENTRY_ERRORS.series
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    const where = { entryId_cardId_series: { entryId, cardId, series } }
    if (stage === null) {
      await tx.diarySeriesExecution.deleteMany({ where: { entryId, cardId, series } })
      return null
    }
    const current = await tx.diarySeriesExecution.findUnique({ where })
    if (current && stageOf(current.value) === stage) return null
    await tx.diarySeriesExecution.upsert({
      where,
      create: { entryId, cardId, series, value: valueOfStage(stage) },
      update: { value: valueOfStage(stage) },
    })
    return null
  })
}

export type DiarySection = "wellbeing" | "prognosis" | "feedback" | "disturbed" | "execution"

/** einen Abschnitt leeren („Entfernen“); danach ist er wieder eine Zeile mit „+“ */
export async function clearSection(
  db: Db,
  userId: string,
  entryId: string,
  section: DiarySection
): Promise<string | null> {
  if (!["wellbeing", "prognosis", "feedback", "disturbed", "execution"].includes(section))
    return ERRORS.failed
  return run(db, async (tx) => {
    if (!(await lockEntry(tx, userId, entryId))) return ERRORS.missing
    if (section === "wellbeing" || section === "prognosis" || section === "feedback")
      await tx.diaryScale.deleteMany({ where: { entryId, part: section } })
    if (section === "prognosis")
      await tx.diaryEntry.update({ where: { id: entryId }, data: { expectedScore: null } })
    if (section === "disturbed")
      await tx.diaryEntry.update({ where: { id: entryId }, data: { disturbed: null } })
    if (section === "execution") await tx.diarySeriesExecution.deleteMany({ where: { entryId } })
    return null
  })
}

/** „Als Vorhaben nehmen“: die letzte Frage derselben Disziplin wird das Vorhaben, solange es leer ist */
export async function takeQuestion(
  db: Db,
  userId: string,
  entryId: string
): Promise<string | null> {
  const entry = await db.diaryEntry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    select: { day: true, familyId: true },
  })
  if (!entry) return ERRORS.missing
  const last = await lastQuestion(db, userId, {
    familyId: entry.familyId,
    beforeDay: dayOfDate(entry.day),
  })
  if (!last) return ERRORS.failed
  return run(db, async (tx) => {
    const locked = await lockEntry(tx, userId, entryId)
    if (!locked) return ERRORS.missing
    if (locked.intention) return null
    await tx.diaryEntry.update({
      where: { id: entryId },
      data: { intention: `Wie schaffe ich es, ${last.question}` },
    })
    return null
  })
}
