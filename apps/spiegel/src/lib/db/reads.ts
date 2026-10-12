// Lesen für die Ansichten (ADR-031): Liste, Fortschritt und Start lesen Scheiben mit ihrer Projektion und ohne Schüsse
// (Index `Card(ownerId, familyId, startedAt)` bzw. `Card(ownerId, startedAt)`), die kleinen Scheiben nur die Lagen der
// gezeigten (`marksOfCards`); nur die Seite einer Scheibe lädt Schüsse, die der aktuellen Revision.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import type { CardMark, CardProjection, ProjectedCard } from "@vereinsheim/shot-core/projection"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import type { CardState, Prisma } from "@/generated/prisma/client"

import type { Db } from "../db"
import { cardScoring } from "../scoring"
import { shotFromRow, toMetricShot } from "./cards"

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
}

const OVERVIEW_SELECT = {
  id: true,
  startedAt: true,
  kind: true,
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
    // amtliche Wertung der Disziplin (SF-74), wenn bekannt; nur Probe ist Training und hat keine (wie im Labor)
    const official = projection.probeOnly ? null : row.discipline.officialScoring
    return [
      {
        id: row.id,
        startedAtMs: row.startedAt.getTime(),
        kind: row.kind,
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
        projection,
      },
    ]
  })
}

/** die Wertung einer Scheibe aus ihrer Zeile, mit der amtlichen, wie die Scheibe sie zeigt */
const scoringOfRow = (
  row: Pick<OverviewRow, "kind" | "standScoring" | "scoringChoice">,
  official: Scoring | null
) => cardScoring({ kind: row.kind, official, stand: row.standScoring, choice: row.scoringChoice })

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
      deletedAt: null,
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
    where: { ownerId: query.ownerId, deletedAt: null, startedAt: startedAt(query) },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: OVERVIEW_SELECT,
  })
  return toOverview(rows)
}

/** Beginn der neuesten Scheibe eines Schützen; null ohne Scheiben */
export async function latestCardStart(db: Db, ownerId: string): Promise<number | null> {
  const latest = await db.card.findFirst({
    where: { ownerId, deletedAt: null },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  })
  return latest?.startedAt.getTime() ?? null
}

const PAGE_CARD_SELECT = {
  id: true,
  startedAt: true,
  kind: true,
  complete: true,
  flags: true,
  standScoring: true,
  scoringChoice: true,
  disciplineId: true,
  discipline: { select: { name: true, targetId: true, officialScoring: true } },
  family: { select: { slug: true, name: true } },
  currentRevision: {
    select: { number: true, shots: { orderBy: { seq: "asc" } } },
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
  /** Scheibenbild aus der Disziplin; null, solange es unbekannt ist */
  targetId: TargetId | null
  family: { slug: string; name: string } | null
  /** die Wertung der Scheibe: gewählt, sonst die Vorgabe (`cardScoring`); mit ihr öffnet die Seite */
  scoring: Scoring
}

function toPageCard(row: PageCardRow): PageCard | null {
  if (!row.currentRevision) return null
  // nur Probe ist Training und hat keine amtliche Wertung (wie im Labor)
  const official = row.currentRevision.shots.some((shot) => shot.stellung !== 0)
    ? row.discipline.officialScoring
    : null
  return {
    id: row.id,
    startedAtMs: row.startedAt.getTime(),
    kind: row.kind,
    complete: row.complete,
    flags: row.flags,
    ...(official ? { official } : {}),
    revision: row.currentRevision.number,
    disciplineId: row.disciplineId,
    discipline: row.discipline.name,
    targetId: isTargetId(row.discipline.targetId) ? row.discipline.targetId : null,
    family: row.family,
    scoring: scoringOfRow(row, official),
    shots: row.currentRevision.shots.map(shotFromRow).map(toMetricShot),
  }
}

const isTargetId = (value: string | null): value is TargetId =>
  value !== null && Object.hasOwn(TARGETS, value)

/**
 * Seite einer Scheibe: die Scheibe mit den Schüssen ihrer aktuellen Revision, nur für ihren Besitzer; null, wenn es
 * sie nicht gibt, sie gelöscht ist oder einem anderen gehört
 */
export async function cardWithShots(
  db: Db,
  query: { cardId: string; ownerId: string }
): Promise<PageCard | null> {
  const row = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, deletedAt: null },
    select: PAGE_CARD_SELECT,
  })
  return row ? toPageCard(row) : null
}

/**
 * Die Lagen der kleinen Scheiben (`cardMarks` der Projektion) für die Scheiben, die eine Seite zeigt, nur eigene und
 * nicht gelöschte; nach Id. Eine Übersicht liest sie getrennt, damit Start für die Rechnung über die ganze Familie nicht
 * die Lagen jeder Scheibe lädt.
 */
export async function marksOfCards(
  db: Db,
  query: { ownerId: string; ids: readonly string[] }
): Promise<Record<string, CardMark[]>> {
  if (!query.ids.length) return {}
  const rows = await db.cardProjection.findMany({
    where: { cardId: { in: [...query.ids] }, card: { ownerId: query.ownerId, deletedAt: null } },
    select: { cardId: true, marks: true },
  })
  return Object.fromEntries(rows.map((row) => [row.cardId, row.marks as unknown as CardMark[]]))
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
