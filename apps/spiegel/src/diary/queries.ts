// Was die Seiten des Tagebuchs lesen. Scheiben kommen nur über die Schnittstelle des Ergebnisteils
// (`@/lib/results-read`), welche zu welchem Eintrag gehört, sagt `entryCards`. Lesen schreibt nie.

import { formatIsoDate } from "@vereinsheim/lib/format"

import type { Db } from "@/lib/db"
import {
  resultCards,
  resultCardSeries,
  resultFamilies,
  type ResultCard,
  type ResultSeries,
} from "@/lib/results-read"

import {
  activeLinks,
  cardPlace,
  entryCards,
  entryOfCard,
  type CardLinkRow,
  type CardPlace,
  type EntryRef,
} from "./cards"
import { proposals, type Proposal } from "./proposals"
import type { ScalePart } from "./scales"
import { entryTitle, type DiaryKindValue } from "./summaries"
import { dayOfDate } from "./validation"

export interface Family {
  id: number
  slug: string
  name: string
}

const ENTRY_REF = { id: true, day: true, familyId: true, deletedAt: true } as const
const toRef = (row: {
  id: string
  day: Date
  familyId: number | null
  deletedAt: Date | null
}): EntryRef => ({
  id: row.id,
  day: dayOfDate(row.day),
  familyId: row.familyId,
  deleted: row.deletedAt !== null,
})
const toCardRef = (card: ResultCard) => ({
  id: card.id,
  day: card.day,
  familyId: card.family?.id ?? null,
})

/** Einträge, Zeilen und Scheiben eines Kontos, aus denen `entryCards` rechnet; mit `ids` nur diese Scheiben */
async function linkData(db: Db, userId: string, timeZone: string, ids?: readonly string[]) {
  const [entries, links, cards] = await Promise.all([
    db.diaryEntry.findMany({ where: { userId }, select: ENTRY_REF }),
    db.diaryEntryCard.findMany({
      where: { entry: { userId } },
      select: { cardId: true, entryId: true, link: true },
    }),
    resultCards(db, { ownerId: userId, timeZone, ids }),
  ])
  return { entries: entries.map(toRef), links: links as CardLinkRow[], cards }
}

const familyMap = async (db: Db, userId: string) =>
  new Map((await resultFamilies(db, userId)).map((family) => [family.id, family]))

export interface EntrySummary {
  id: string
  day: string
  kind: DiaryKindValue
  family: Family | null
  intention: string | null
  note: string | null
  /** die Scheiben, die es gibt: verknüpfte und dazugekommene, in zeitlicher Folge */
  cards: ResultCard[]
}

/** die Liste: alle Einträge, die nicht im Papierkorb liegen, neueste oben */
export async function diaryList(db: Db, userId: string, timeZone: string): Promise<EntrySummary[]> {
  const [{ entries, links, cards }, families, rows] = await Promise.all([
    linkData(db, userId, timeZone),
    familyMap(db, userId),
    db.diaryEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: { id: true, day: true, kind: true, familyId: true, intention: true, note: true },
    }),
  ])
  const sets = entryCards(entries, links, cards.map(toCardRef))
  const cardOf = new Map(cards.map((card) => [card.id, card]))
  return rows.map((row) => {
    const set = sets.get(row.id)!
    return {
      id: row.id,
      day: dayOfDate(row.day),
      kind: row.kind,
      family: row.familyId === null ? null : (families.get(row.familyId) ?? null),
      intention: row.intention,
      note: row.note,
      cards: [...set.linked, ...set.added]
        .flatMap((id) => cardOf.get(id) ?? [])
        .sort((a, b) => a.startedAtMs - b.startedAtMs),
    }
  })
}

export interface EntryCardView {
  /** verknüpft; `card` null, wenn es die Scheibe nicht mehr gibt (gelöscht) */
  linked: { id: string; card: ResultCard | null }[]
  added: ResultCard[]
  offered: ResultCard[]
  /** Scheiben dieses Tages und dieser Disziplin, die in einem anderen Eintrag stecken, mit dessen Titel */
  elsewhere: { card: ResultCard; entryId: string; title: string }[]
}

export interface EntryView {
  id: string
  day: string
  kind: DiaryKindValue
  family: Family | null
  intention: string | null
  note: string | null
  outcome: "yes" | "partly" | "no" | null
  learned: string | null
  question: string | null
  disturbed: string | null
  expectedScore: number | null
  scales: { part: ScalePart; aspect: string; value: number }[]
  executions: { cardId: string; series: number; value: number }[]
  cards: EntryCardView
  /** die Serien jeder Scheibe des Eintrags, für die Ausführung */
  series: Record<string, ResultSeries[]>
  /** die letzte Frage derselben Disziplin aus einem früheren Eintrag */
  thread: { entryId: string; day: string; question: string } | null
  /** eine Scheibe des Eintrags ist ein Wettkampf */
  competition: boolean
  /** keine Scheibe verknüpft oder dazugekommen: Tag, Art und Disziplin sind änderbar */
  basicsEditable: boolean
}

/** die Seite eines eigenen Eintrags, der nicht im Papierkorb liegt; sonst null */
export async function entryView(
  db: Db,
  userId: string,
  entryId: string,
  timeZone: string
): Promise<EntryView | null> {
  const row = await db.diaryEntry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    include: { scales: true, executions: true },
  })
  if (!row) return null
  const day = dayOfDate(row.day)
  const [{ entries, links, cards }, families, thread] = await Promise.all([
    linkData(db, userId, timeZone),
    familyMap(db, userId),
    lastQuestion(db, userId, { familyId: row.familyId, beforeDay: day }),
  ])
  const set = entryCards(entries, links, cards.map(toCardRef)).get(row.id)!
  const cardOf = new Map(cards.map((card) => [card.id, card]))
  const pick = (ids: string[]) =>
    ids.flatMap((id) => cardOf.get(id) ?? []).sort((a, b) => a.startedAtMs - b.startedAtMs)
  const linked = set.linked
    .map((id) => ({ id, card: cardOf.get(id) ?? null }))
    .sort((a, b) => (a.card?.startedAtMs ?? Infinity) - (b.card?.startedAtMs ?? Infinity))
  const own = [...pick(set.linked), ...pick(set.added)]
  const others = cards
    .filter((card) => card.day === day && row.familyId !== null && card.family?.id === row.familyId)
    .map((card) => ({ card, entryId: entryOfCard(toCardRef(card), entries, links) }))
    .filter((x): x is { card: ResultCard; entryId: string } => !!x.entryId && x.entryId !== row.id)
  const titles = new Map(
    (
      await db.diaryEntry.findMany({
        where: { userId, id: { in: others.map((x) => x.entryId) } },
        select: { id: true, intention: true, kind: true },
      })
    ).map((e) => [
      e.id,
      entryTitle({
        intention: e.intention,
        family: row.familyId === null ? null : (families.get(row.familyId)?.name ?? null),
        kind: e.kind,
      }),
    ])
  )
  const series: Record<string, ResultSeries[]> = {}
  for (const card of own)
    series[card.id] = (await resultCardSeries(db, { ownerId: userId, cardId: card.id })) ?? []
  return {
    id: row.id,
    day,
    kind: row.kind,
    family: row.familyId === null ? null : (families.get(row.familyId) ?? null),
    intention: row.intention,
    note: row.note,
    outcome: row.outcome,
    learned: row.learned,
    question: row.question,
    disturbed: row.disturbed,
    expectedScore: row.expectedScore === null ? null : Number(row.expectedScore),
    scales: row.scales.map((s) => ({ part: s.part, aspect: s.aspect, value: s.value })),
    executions: row.executions.map((e) => ({ cardId: e.cardId, series: e.series, value: e.value })),
    cards: {
      linked,
      added: pick(set.added),
      offered: pick(set.offered),
      elsewhere: others
        .sort((a, b) => a.card.startedAtMs - b.card.startedAtMs)
        .map((x) => ({ ...x, title: titles.get(x.entryId) ?? "" })),
    },
    series,
    thread,
    competition: own.some((card) => card.kind === "competition"),
    basicsEditable: set.linked.length === 0 && set.added.length === 0,
  }
}

/**
 * Die letzte Frage („Wie schaffe ich es, …?“) derselben Disziplin aus einem Eintrag vor diesem Tag, der nicht im
 * Papierkorb liegt; ohne Disziplin keine
 */
export async function lastQuestion(
  db: Db,
  userId: string,
  query: { familyId: number | null; beforeDay: string }
): Promise<{ entryId: string; day: string; question: string } | null> {
  if (query.familyId === null) return null
  const row = await db.diaryEntry.findFirst({
    where: {
      userId,
      familyId: query.familyId,
      deletedAt: null,
      question: { not: null },
      day: { lt: new Date(`${query.beforeDay}T00:00:00.000Z`) },
    },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    select: { id: true, day: true, question: true },
  })
  return row ? { entryId: row.id, day: dayOfDate(row.day), question: row.question! } : null
}

export interface ThreadItem {
  entryId: string
  day: string
  question: string
  learned: string | null
}

/**
 * Der Faden: die Disziplinen mit Fragen (die mit der jüngsten Frage zuerst) und die Fragen der gewählten, neueste
 * oben; ohne Wahl die erste
 */
export async function threadView(
  db: Db,
  userId: string,
  familySlug: string | null
): Promise<{ families: Family[]; family: Family | null; items: ThreadItem[] }> {
  const [rows, families] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, deletedAt: null, question: { not: null }, familyId: { not: null } },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: { id: true, day: true, familyId: true, question: true, learned: true },
    }),
    familyMap(db, userId),
  ])
  const withQuestion: Family[] = []
  for (const row of rows) {
    const family = families.get(row.familyId!)
    if (family && !withQuestion.some((f) => f.id === family.id)) withQuestion.push(family)
  }
  const family = withQuestion.find((f) => f.slug === familySlug) ?? withQuestion[0] ?? null
  return {
    families: withQuestion,
    family,
    items: family
      ? rows
          .filter((row) => row.familyId === family.id)
          .map((row) => ({
            entryId: row.id,
            day: dayOfDate(row.day),
            question: row.question!,
            learned: row.learned,
          }))
      : [],
  }
}

/** „Neuer Eintrag“: Vorschläge der letzten 30 Tage, die Disziplinen für einen Eintrag ohne Scheibe, heute */
export async function newEntryView(
  db: Db,
  userId: string,
  timeZone: string,
  markedCardId: string | null
): Promise<{ proposals: Proposal<ResultCard>[]; families: Family[]; today: string }> {
  const nowMs = Date.now()
  // jeder Abend ohne Eintrag, egal wie alt: dieselbe Regel wie an der Scheibe und auf Start (`cardPlace`)
  const [{ entries, links, cards }, families] = await Promise.all([
    linkData(db, userId, timeZone),
    resultFamilies(db, userId),
  ])
  const linked = new Set(
    activeLinks(entries, links)
      .filter((l) => l.link === "linked")
      .map((l) => l.cardId)
  )
  return {
    proposals: proposals(cards, entries, linked, markedCardId),
    families,
    today: formatIsoDate(new Date(nowMs), timeZone),
  }
}

/** der Eintrag, zu dem eine eigene Scheibe gehört (verknüpft oder dazugekommen), mit seinem Tag; sonst null */
export async function entryForCard(
  db: Db,
  userId: string,
  cardId: string,
  timeZone: string
): Promise<{ entryId: string; day: string } | null> {
  const { entries, links, cards } = await linkData(db, userId, timeZone, [cardId])
  const card = cards.find((c) => c.id === cardId)
  if (!card) return null
  const entryId = entryOfCard(toCardRef(card), entries, links)
  const entry = entries.find((e) => e.id === entryId)
  return entry ? { entryId: entry.id, day: entry.day } : null
}

/** wo eine eigene Scheibe im Tagebuch steht (`cardPlace`), mit dem Tag des Eintrags; null ohne eigene Scheibe */
export async function cardPlaceOf(
  db: Db,
  userId: string,
  cardId: string,
  timeZone: string
): Promise<{ place: CardPlace; day: string | null } | null> {
  const { entries, links, cards } = await linkData(db, userId, timeZone, [cardId])
  const card = cards.find((c) => c.id === cardId)
  if (!card) return null
  const place = cardPlace(toCardRef(card), entries, links)
  const day =
    place.kind === "none" ? null : (entries.find((e) => e.id === place.entryId)?.day ?? null)
  return { place, day }
}

/**
 * Je Abend und Disziplin (Familie über ihre Kennung), wohin die Zeile auf Start führt: in den Eintrag der neuesten
 * Scheibe, die in einem steckt, sonst in den, der sie anbietet, sonst zum Anlegen mit der neuesten Scheibe, die in
 * keinem Eintrag steht; ohne eigene Scheibe mit Disziplin keine Zeile (null).
 */
export async function eveningEntries(
  db: Db,
  userId: string,
  evenings: readonly { day: string; familySlug: string; cardIds: readonly string[] }[],
  timeZone: string
): Promise<Map<string, { entryId: string } | { cardId: string } | null>> {
  const { entries, links, cards } = await linkData(
    db,
    userId,
    timeZone,
    evenings.flatMap((evening) => evening.cardIds)
  )
  const result = new Map<string, { entryId: string } | { cardId: string } | null>()
  for (const evening of evenings) {
    const places = cards
      .filter((card) => evening.cardIds.includes(card.id))
      .sort((a, b) => b.startedAtMs - a.startedAtMs)
      .map((card) => ({ cardId: card.id, place: cardPlace(toCardRef(card), entries, links) }))
    const pick = (kind: CardPlace["kind"]) => places.find((p) => p.place.kind === kind)
    const found = pick("entry") ?? pick("offered")
    const free = pick("none")
    result.set(
      `${evening.day}|${evening.familySlug}`,
      found && found.place.kind !== "none"
        ? { entryId: found.place.entryId }
        : free
          ? { cardId: free.cardId }
          : null
    )
  }
  return result
}
