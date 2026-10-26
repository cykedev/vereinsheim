// Lesen für die Ansichten (ADR-031): Liste, Fortschritt und Start lesen Scheiben mit ihrer Projektion und ohne Schüsse
// (Index `Card(ownerId, familyId, startedAt)` bzw. `Card(ownerId, startedAt)`), die kleinen Scheiben nur die Lagen der
// gezeigten (`marksOfCards`); nur die Seite einer Scheibe lädt Schüsse, die der aktuellen Revision.

import type { PatternCard, PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import {
  markShots,
  type CardMark,
  type CardProjection,
  type ProjectedCard,
} from "@vereinsheim/shot-core/projection"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import type { CardState, Prisma } from "@/generated/prisma/client"

import type { Db } from "../db"
import { cardScoring } from "../scoring"
import {
  CHOICE_SELECT,
  choiceWhere,
  shotFromRow,
  toMetricShot,
  type DisciplineOption,
} from "./cards"
import { NOT_MINE } from "./purge"
import { trashEndsAt } from "./trash"
import { PENDING_CARD, SHOWN_DISCIPLINE, VISIBLE_CARD } from "./visible"

/** eine Scheibe für die Übersichten: Merkmale und Projektion, dazu Familie und Scheibenbild für Filter und Bild */
export interface OverviewCard extends ProjectedCard {
  disciplineId: number
  familyId: number | null
  /** Familie der Disziplin (Kennung in der Adresse, Name); null, solange keine zugeordnet ist */
  family: { slug: string; name: string } | null
  /** Scheibenbild der Disziplin; null, solange es unbekannt ist */
  targetId: TargetId | null
  state: CardState
  stand: string | null
  /** die Wertung der Scheibe: gewählt, sonst die Vorgabe (`cardScoring`) */
  scoring: Scoring
  /** die Liste aus Meyton (die `Rangliste`); null ohne (PDF, `seed:own`) */
  list: CardList | null
}

/** die Liste einer Scheibe, wie Meyton sie nennt; die Kennung ist die der Zeile `Ranking` */
export interface CardList {
  id: number
  name: string
}

const listOf = (ranking: { id: number; name: string } | null): CardList | null =>
  ranking ? { id: ranking.id, name: ranking.name } : null

const OVERVIEW_SELECT = {
  id: true,
  startedAt: true,
  kind: true,
  kindChoice: true,
  ranking: { select: { id: true, name: true, kind: true } },
  complete: true,
  flags: true,
  state: true,
  stand: true,
  standScoring: true,
  scoringChoice: true,
  disciplineId: true,
  familyId: true,
  family: { select: { slug: true, name: true } },
  discipline: { select: { officialScoring: true, targetId: true } },
  projection: {
    select: {
      version: true,
      probeOnly: true,
      suspicious: true,
      printedShots: true,
      values: true,
      records: true,
    },
  },
} satisfies Prisma.CardSelect

type OverviewRow = Prisma.CardGetPayload<{ select: typeof OVERVIEW_SELECT }>

/** Scheiben ohne Projektion (noch nicht gerechnet) fehlen, bis `refreshProjections` sie nachholt */
function toOverview(rows: readonly OverviewRow[]): OverviewCard[] {
  return rows.flatMap((row) => {
    if (!row.projection) return []
    const projection: CardProjection = {
      version: row.projection.version,
      probeOnly: row.projection.probeOnly,
      suspicious: row.projection.suspicious,
      printedShots: row.projection.printedShots,
      values: row.projection.values as CardProjection["values"],
      records: row.projection.records as unknown as CardProjection["records"],
    }
    // Wertung der Disziplin (Admin), wenn gesetzt; nur Probe hat keine
    const official = projection.probeOnly ? null : row.discipline.officialScoring
    return [
      {
        id: row.id,
        startedAtMs: row.startedAt.getTime(),
        kind: kindOfRow(row, projection.probeOnly),
        complete: row.complete,
        flags: row.flags,
        ...(official ? { official } : {}),
        state: row.state,
        stand: row.stand,
        scoring: scoringOfRow(row, official),
        disciplineId: row.disciplineId,
        familyId: row.familyId,
        family: row.family,
        targetId: isTargetId(row.discipline.targetId) ? row.discipline.targetId : null,
        list: listOf(row.ranking),
        projection,
      },
    ]
  })
}

/**
 * die geltende Art einer Scheibe: gewählt, sonst die Zuordnung ihrer Rangliste durch den Admin, sonst die der Quelle (ein
 * Stand schreibt nur `kind` und die Rangliste). Die Zuordnung gilt beim Lesen: Ändert der Admin sie, folgen alle Scheiben.
 * Nur Probe ist Training (der Schütze kann es dort nicht umstellen): Die Rangliste zählt dann nicht.
 */
export const kindOfRow = (
  row: Pick<OverviewRow, "kind" | "kindChoice"> & {
    ranking: Pick<NonNullable<OverviewRow["ranking"]>, "kind"> | null
  },
  probeOnly: boolean
) => row.kindChoice ?? (probeOnly ? null : row.ranking?.kind) ?? row.kind

/** die Wertung einer Scheibe aus ihrer Zeile und der Wertung ihrer Disziplin, wie die Scheibe sie zeigt */
const scoringOfRow = (
  row: Pick<OverviewRow, "standScoring" | "scoringChoice">,
  official: Scoring | null
) => cardScoring({ official, stand: row.standScoring, choice: row.scoringChoice })

/** von `fromMs` (eingeschlossen) bis `toMs` (ausgeschlossen), beides wahlweise */
export interface MsRange {
  fromMs?: number
  toMs?: number
}

function startedAt({ fromMs, toMs }: MsRange) {
  if (fromMs === undefined && toMs === undefined) return undefined
  return {
    ...(fromMs === undefined ? {} : { gte: new Date(fromMs) }),
    ...(toMs === undefined ? {} : { lt: new Date(toMs) }),
  }
}

/** Liste und Fortschritt: die Scheiben eines Schützen in einer Familie, nach Beginn */
export async function familyCards(
  db: Db,
  query: { ownerId: string; familyId: number } & MsRange
): Promise<OverviewCard[]> {
  const rows = await db.card.findMany({
    where: {
      ownerId: query.ownerId,
      familyId: query.familyId,
      ...VISIBLE_CARD,
      startedAt: startedAt(query),
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: OVERVIEW_SELECT,
  })
  return toOverview(rows)
}

/** Start: die Scheiben eines Schützen über alle Familien in einem Zeitraum (der letzte Abend) */
export async function ownerCards(
  db: Db,
  query: { ownerId: string } & MsRange
): Promise<OverviewCard[]> {
  const rows = await db.card.findMany({
    where: { ownerId: query.ownerId, ...VISIBLE_CARD, startedAt: startedAt(query) },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: OVERVIEW_SELECT,
  })
  return toOverview(rows)
}

/**
 * Die eigene Scheibe direkt vor einer anderen in derselben Familie (Beginn, bei Gleichstand die Id wie `byStart`), für
 * „Mit der Scheibe davor vergleichen“; nur sichtbare mit Scheibenbild wie die Übersichten. Eine Abfrage über den Index
 * (Besitzer, Familie, Beginn) statt aller Scheiben; null ohne
 */
export async function previousInFamily(
  db: Db,
  query: { ownerId: string; family: string; startedAtMs: number; id: string }
): Promise<string | null> {
  const at = new Date(query.startedAtMs)
  const row = await db.card.findFirst({
    where: {
      ownerId: query.ownerId,
      ...VISIBLE_CARD,
      discipline: { ignoredAt: null, targetId: { not: null } },
      family: { slug: query.family },
      OR: [{ startedAt: { lt: at } }, { startedAt: at, id: { lt: query.id } }],
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  })
  return row?.id ?? null
}

/** Beginn der neuesten Scheibe eines Schützen; null ohne Scheiben */
export async function latestCardStart(db: Db, ownerId: string): Promise<number | null> {
  const latest = await db.card.findFirst({
    where: { ownerId, ...VISIBLE_CARD },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  })
  return latest?.startedAt.getTime() ?? null
}

const PAGE_CARD_SELECT = {
  id: true,
  startedAt: true,
  kind: true,
  kindChoice: true,
  ranking: { select: { id: true, name: true, kind: true } },
  complete: true,
  flags: true,
  standScoring: true,
  scoringChoice: true,
  disciplineId: true,
  discipline: { select: { name: true, targetId: true, officialScoring: true } },
  standDiscipline: { select: { name: true } },
  family: { select: { slug: true, name: true } },
  currentRevision: {
    select: {
      number: true,
      shots: { orderBy: { seq: "asc" } },
      // Summen der Wertung: Probe neben ihnen macht keine Scheibe nur aus Probe
      totalShots: true,
      seriesSums: { select: { shots: true } },
    },
  },
} satisfies Prisma.CardSelect

type PageCardRow = Prisma.CardGetPayload<{ select: typeof PAGE_CARD_SELECT }>

/**
 * Eine Scheibe für die Seiten: wie der Fachkern sie braucht (`PeriodCard` mit den Schüssen der aktuellen Revision in
 * Abgabefolge), dazu Revision, Disziplin, Scheibenbild und Familie
 */
export interface PageCard extends PeriodCard {
  revision: number
  disciplineId: number
  discipline: string
  /** die Disziplin am Stand, wenn der Schütze eine andere gewählt hat; null ohne eigene Wahl */
  standDiscipline: string | null
  /** Scheibenbild aus der Disziplin; null, solange es unbekannt ist */
  targetId: TargetId | null
  family: { slug: string; name: string } | null
  /** die Wertung der Scheibe: gewählt, sonst die Vorgabe (`cardScoring`); mit ihr öffnet die Seite */
  scoring: Scoring
  /** die Liste aus Meyton; null ohne */
  list: CardList | null
}

function toPageCard(row: PageCardRow): PageCard | null {
  if (!row.currentRevision) return null
  // nur Probe hat keine Wertung der Disziplin; eine Scheibe ohne Schüsse (wartet auf die Anlage) und Probe neben Summen
  // der Wertung sind keine Probe (wie `probeOnly` der Projektion)
  const { shots, totalShots, seriesSums } = row.currentRevision
  const probeOnly =
    shots.length > 0 &&
    shots.every((shot) => shot.stellung === 0) &&
    totalShots === null &&
    seriesSums.length === 0
  const official = probeOnly ? null : row.discipline.officialScoring
  return {
    id: row.id,
    startedAtMs: row.startedAt.getTime(),
    kind: kindOfRow(row, probeOnly),
    complete: row.complete,
    flags: row.flags,
    ...(official ? { official } : {}),
    revision: row.currentRevision.number,
    disciplineId: row.disciplineId,
    discipline: row.discipline.name,
    standDiscipline: row.standDiscipline?.name ?? null,
    targetId: isTargetId(row.discipline.targetId) ? row.discipline.targetId : null,
    family: row.family,
    scoring: scoringOfRow(row, official),
    list: listOf(row.ranking),
    shots: row.currentRevision.shots.map(shotFromRow).map(toMetricShot),
  }
}

const isTargetId = (value: string | null): value is TargetId =>
  value !== null && Object.hasOwn(TARGETS, value)

/**
 * Seite einer Scheibe: die Scheibe mit den Schüssen ihrer aktuellen Revision, nur für ihren Besitzer; null, wenn es
 * sie nicht gibt, sie gelöscht ist, wartet oder einem anderen gehört
 */
export async function cardWithShots(
  db: Db,
  query: { cardId: string; ownerId: string }
): Promise<PageCard | null> {
  const row = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, ...VISIBLE_CARD },
    select: PAGE_CARD_SELECT,
  })
  return row ? toPageCard(row) : null
}

/**
 * Geteilte Scheibe (`/share/<uuid>`): wie `cardWithShots`, aber über den Link statt über den Besitzer; null, wenn das
 * Teilen beendet ist, die Scheibe gelöscht ist, wartet, ihre Disziplin ignoriert ist oder das Konto aus ist. Ob der
 * Besitzer die Disziplin gewählt hat, steht nicht darin.
 */
export async function sharedCard(db: Db, shareId: string): Promise<PageCard | null> {
  const row = await db.card.findFirst({
    where: { shareId, ...VISIBLE_CARD, owner: { isActive: true } },
    select: PAGE_CARD_SELECT,
  })
  const card = row ? toPageCard(row) : null
  return card && { ...card, standDiscipline: null }
}

/**
 * Die Disziplinen, die der Schütze für eine eigene, sichtbare Scheibe wählen kann (`choiceWhere`), nach Familie und Name,
 * je mit der Wertung, in der die Scheibe dann zählt; leer, wenn es die Scheibe für ihn nicht gibt
 */
export async function disciplineOptions(
  db: Db,
  query: { cardId: string; ownerId: string }
): Promise<DisciplineOption[]> {
  const card = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, ...VISIBLE_CARD },
    select: {
      ...CHOICE_SELECT,
      standScoring: true,
      scoringChoice: true,
      projection: { select: { probeOnly: true } },
    },
  })
  if (!card) return []
  const choice = choiceWhere(card)
  const rows = await db.discipline.findMany({
    where: choice.where,
    select: { id: true, name: true, officialScoring: true, family: { select: { name: true } } },
    orderBy: [{ family: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  })
  // nur Probe hat keine Wertung der Disziplin (wie `toPageCard`)
  const probeOnly = card.projection?.probeOnly ?? false
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    family: row.family?.name ?? null,
    stand: row.id === choice.standId,
    current: row.id === card.disciplineId,
    scoring: scoringOfRow(card, probeOnly ? null : row.officialScoring),
  }))
}

/** der Link einer eigenen Scheibe; null, wenn sie nicht geteilt ist */
export async function ownCardShare(
  db: Db,
  query: { cardId: string; ownerId: string }
): Promise<{ shareId: string; sharedAtMs: number } | null> {
  const row = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, shareId: { not: null } },
    select: { shareId: true, sharedAt: true },
  })
  return row?.shareId && row.sharedAt
    ? { shareId: row.shareId, sharedAtMs: row.sharedAt.getTime() }
    : null
}

/**
 * Die Lagen der kleinen Scheiben (`cardMarks` der Projektion) für die Scheiben, die eine Seite zeigt, nur eigene und
 * sichtbare (`pending`: nur wartende, für „Offen“); nach Id. Eine Übersicht liest sie getrennt, damit Start für die Rechnung über die ganze Familie nicht
 * die Lagen jeder Scheibe lädt.
 */
export async function marksOfCards(
  db: Db,
  query: { ownerId: string; ids: readonly string[]; pending?: boolean }
): Promise<Record<string, CardMark[]>> {
  if (!query.ids.length) return {}
  const rows = await db.cardProjection.findMany({
    where: {
      cardId: { in: [...query.ids] },
      // nicht gelöscht, sichtbar oder (nur ausdrücklich, für „Offen“) wartend. Ohne Bedingung an die Disziplin: Die
      // Kennungen kommen aus einer Ansicht, die ignorierte schon ausgelassen hat, und die Bedingung über die Relation
      // kostete bei der Liste „Alles“ rund 40 ms (`pnpm measure`)
      card: { ownerId: query.ownerId, deletedAt: null, ownerPending: query.pending ?? false },
    },
    select: { cardId: true, marks: true },
  })
  return Object.fromEntries(rows.map((row) => [row.cardId, row.marks as unknown as CardMark[]]))
}

/**
 * Die Scheiben des Trefferbilds im Fortschritt (`periodPattern`): je verlangter, eigener, sichtbarer Scheibe die Lagen
 * aus der Projektion und der Beginn, mit denselben Bedingungen wie `marksOfCards`. Ohne Schüsse aus der Datenbank:
 * Die Lagen der Projektion sind die gezeichneten (wie am Ausdruck, ohne verdächtige).
 */
export async function patternCardsOf(
  db: Db,
  query: { ownerId: string; ids: readonly string[] }
): Promise<PatternCard[]> {
  if (!query.ids.length) return []
  const rows = await db.cardProjection.findMany({
    where: {
      cardId: { in: [...query.ids] },
      card: { ownerId: query.ownerId, deletedAt: null, ownerPending: false },
    },
    select: { cardId: true, marks: true, card: { select: { startedAt: true } } },
  })
  return rows.map((row) => ({
    id: row.cardId,
    atMs: row.card.startedAt.getTime(),
    points: markShots(row.marks as unknown as CardMark[]),
  }))
}

/** die gespeicherten Wertungen der Familien eines Schützen (`FamilyScoring`) nach Kennung; ohne Zeile fehlt die Familie */
export async function familyScorings(db: Db, ownerId: string): Promise<Record<string, Scoring>> {
  const rows = await db.familyScoring.findMany({
    where: { userId: ownerId },
    select: { scoring: true, family: { select: { slug: true } } },
  })
  return Object.fromEntries(rows.map((row) => [row.family.slug, row.scoring]))
}

/** benannte Zeiträume des Schützen („Vorbereitung Landesmeisterschaft“), Tage als ISO-Datum */
export async function namedPeriods(db: Db, ownerId: string): Promise<NamedPeriod[]> {
  const rows = await db.namedPeriod.findMany({
    where: { ownerId },
    orderBy: [{ from: "asc" }, { name: "asc" }],
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    from: row.from.toISOString().slice(0, 10),
    to: row.to ? row.to.toISOString().slice(0, 10) : null,
  }))
}

/** eine wartende erste Scheibe je SportpassID für „Offen“: die älteste und wie viele unter derselben Nummer noch warten */
export interface PendingFirstCard {
  sportpassId: string | null
  card: OverviewCard
  more: number
}

/**
 * Wartende Scheiben je Gruppe (Anlage und SportpassID; eine Nummer kann an zwei Anlagen vorkommen), je Gruppe die
 * jüngste, jüngste Gruppe zuerst: Mit dem Nachladen warten womöglich Scheiben aus Jahren, an den letzten Abend erinnert
 * man sich. Nur Scheiben mit Projektion: „Offen“ zeigt sie, und die Zahl am Start-Symbol zählt dieselben Gruppen.
 */
async function pendingGroups(db: Db, ownerId: string) {
  const rows = await db.card.findMany({
    where: { ownerId, ...PENDING_CARD, ...SHOWN_DISCIPLINE, projection: { isNot: null } },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    select: { id: true, sportpassId: true, source: { select: { siteId: true } } },
  })
  const groups = new Map<string, { id: string; sportpassId: string | null; count: number }>()
  for (const row of rows) {
    const key = `${row.source?.siteId ?? ""}:${row.sportpassId?.toString() ?? ""}`
    const group = groups.get(key)
    if (group) group.count++
    else groups.set(key, { id: row.id, sportpassId: row.sportpassId?.toString() ?? null, count: 1 })
  }
  return [...groups.values()]
}

/** „Offen“: je Anlage und SportpassID die jüngste wartende Scheibe des Kontos, die jüngste zuerst */
export async function pendingFirstCards(db: Db, ownerId: string): Promise<PendingFirstCard[]> {
  const groups = await pendingGroups(db, ownerId)
  if (!groups.length) return []
  const cards = toOverview(
    await db.card.findMany({
      where: { id: { in: groups.map((g) => g.id) }, ownerId },
      select: OVERVIEW_SELECT,
    })
  )
  const byId = new Map(cards.map((card) => [card.id, card]))
  return groups.flatMap((group) => {
    const card = byId.get(group.id)
    return card ? [{ sportpassId: group.sportpassId, card, more: group.count - 1 }] : []
  })
}

/**
 * eigene Scheiben, die auf die Einordnung ihrer Disziplin warten: die Disziplin ist neu, nicht ignoriert und ohne
 * Scheibenbild oder Familie, deshalb fehlen sie in den Übersichten (Hinweis auf Start)
 */
export async function waitingForDiscipline(db: Db, ownerId: string): Promise<number> {
  return db.card.count({
    where: {
      ownerId,
      ...VISIBLE_CARD,
      // zusätzlich zur Bedingung von `VISIBLE_CARD` an die Disziplin (nicht ignoriert): neu und ohne Scheibe oder Familie
      AND: [{ discipline: { confirmedAt: null, OR: [{ targetId: null }, { familyId: null }] } }],
    },
  })
}

/** die Zahl am Start-Symbol: so viele Einträge hat „Offen“ */
export async function pendingCount(db: Db, ownerId: string): Promise<number> {
  return (await pendingGroups(db, ownerId)).length
}

/** eine Scheibe im Papierkorb: wie in den Übersichten, dazu wann gelöscht und bis wann wiederherstellbar */
export interface TrashCard {
  card: OverviewCard
  deletedAtMs: number
  endsAtMs: number
}

/** der Papierkorb eines Schützen, zuletzt gelöschte zuerst; ohne Schüsse */
export async function trashCards(db: Db, ownerId: string): Promise<TrashCard[]> {
  const rows = await db.card.findMany({
    where: { ownerId, ownerPending: false, deletedAt: { not: null }, ...SHOWN_DISCIPLINE },
    orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
    select: { ...OVERVIEW_SELECT, deletedAt: true },
  })
  const deletedAt = new Map(rows.map((row) => [row.id, row.deletedAt!]))
  return toOverview(rows).map((card) => {
    const at = deletedAt.get(card.id)!
    return { card, deletedAtMs: at.getTime(), endsAtMs: trashEndsAt(at).getTime() }
  })
}

/** Zahl der Scheiben im Papierkorb (Link im Profil) */
export async function trashCount(db: Db, ownerId: string): Promise<number> {
  // dieselben wie `trashCards`: nur mit Projektion, sonst stünde eine Zahl über einer leeren Liste
  return db.card.count({
    where: {
      ownerId,
      ownerPending: false,
      deletedAt: { not: null },
      projection: { isNot: null },
      ...SHOWN_DISCIPLINE,
    },
  })
}

/**
 * was nicht von selbst wiederkommt: eigene endgültig gelöschte Scheiben (weiche Sperre) und eigene Meldungen
 * „Nicht meine“ (Grabstein mit `userId`), nur Beginn und Zeitpunkt, keine Schussdaten; neueste zuerst
 */
export interface BlockedCard {
  kind: "deleted" | "not-mine"
  startedAtMs: number
  sinceMs: number
}

export async function blockedCards(db: Db, ownerId: string): Promise<BlockedCard[]> {
  const select = { startedAt: true, createdAt: true } as const
  const [locks, tombstones] = await Promise.all([
    db.deleteLock.findMany({ where: { userId: ownerId }, select }),
    db.tombstone.findMany({ where: { userId: ownerId, reason: NOT_MINE }, select }),
  ])
  const of = (kind: BlockedCard["kind"]) => (row: { startedAt: Date; createdAt: Date }) => ({
    kind,
    startedAtMs: row.startedAt.getTime(),
    sinceMs: row.createdAt.getTime(),
  })
  return [...locks.map(of("deleted")), ...tombstones.map(of("not-mine"))].sort(
    (a, b) => b.startedAtMs - a.startedAtMs
  )
}

/**
 * Wo liegt eine eigene Scheibe? `visible` (die Seite zeigt sie), `trash` (die Seite leitet in den Papierkorb), sonst
 * null (unbekannt, fremd oder wartend: 404)
 */
export async function ownCardState(
  db: Db,
  query: { cardId: string; ownerId: string }
): Promise<"visible" | "trash" | null> {
  const card = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, ownerPending: false },
    select: { deletedAt: true, discipline: { select: { ignoredAt: true } } },
  })
  if (!card) return null
  // eine gelöschte Scheibe einer ignorierten Disziplin steht nicht im Papierkorb (`trashCards`)
  if (card.deletedAt) return card.discipline.ignoredAt ? null : "trash"
  return "visible"
}
