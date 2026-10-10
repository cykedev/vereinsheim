// Lesen für die Ansichten (ADR-031): Liste, Fortschritt und Start lesen Scheiben mit ihrer Projektion und ohne Schüsse
// (Index `Card(ownerId, familyId, startedAt)` bzw. `Card(ownerId, startedAt)`); nur die Seite einer Scheibe lädt
// Schüsse, die der aktuellen Revision.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import type { CardProjection, ProjectedCard } from "@vereinsheim/shot-core/projection"

import type { CardState, Prisma, Scoring } from "@/generated/prisma/client"

import type { Db } from "../db"
import { shotFromRow, toMetricShot } from "./cards"

/** eine Scheibe für die Übersichten: Merkmale und Projektion */
export interface OverviewCard extends ProjectedCard {
  disciplineId: number
  familyId: number | null
  /** amtliche Wertung der Disziplin (SF-74); null unbekannt. Training nur aus Probe hat keine, das wertet das Modell */
  official: Scoring | null
  state: CardState
  stand: string | null
}

const OVERVIEW_SELECT = {
  id: true,
  startedAt: true,
  kind: true,
  complete: true,
  flags: true,
  state: true,
  stand: true,
  disciplineId: true,
  familyId: true,
  discipline: { select: { officialScoring: true } },
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
    return [
      {
        id: row.id,
        startedAtMs: row.startedAt.getTime(),
        kind: row.kind,
        complete: row.complete,
        flags: row.flags,
        official: row.discipline.officialScoring,
        state: row.state,
        stand: row.stand,
        disciplineId: row.disciplineId,
        familyId: row.familyId,
        projection,
      },
    ]
  })
}

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
}

function toPageCard(row: PageCardRow): PageCard | null {
  if (!row.currentRevision) return null
  return {
    id: row.id,
    startedAtMs: row.startedAt.getTime(),
    kind: row.kind,
    complete: row.complete,
    flags: row.flags,
    ...(row.discipline.officialScoring ? { official: row.discipline.officialScoring } : {}),
    revision: row.currentRevision.number,
    disciplineId: row.disciplineId,
    discipline: row.discipline.name,
    targetId: isTargetId(row.discipline.targetId) ? row.discipline.targetId : null,
    family: row.family,
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
 * Übergang bis SP-1.8 (ADR-031, Folgen): Start und Liste rechnen in `shot-ui` noch aus Schüssen, und die kleinen
 * Scheiben der Liste brauchen die Lagen. Bis die Modelle die Projektion nehmen, lädt dieser Zugriff alle Scheiben
 * des Schützen mit Schüssen, nach Beginn. Für die Übersichten danach: `familyCards`.
 */
export async function ownerCardsWithShots(db: Db, ownerId: string): Promise<PageCard[]> {
  const rows = await db.card.findMany({
    where: { ownerId, deletedAt: null, currentRevisionId: { not: null } },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: PAGE_CARD_SELECT,
  })
  return rows.flatMap((row) => toPageCard(row) ?? [])
}
