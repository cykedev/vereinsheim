// Lesen für die Ansichten (ADR-031): Liste, Fortschritt und Start lesen Scheiben mit ihrer Projektion und ohne Schüsse
// (Index `Card(ownerId, familyId, startedAt)` bzw. `Card(ownerId, startedAt)`); nur die Seite einer Scheibe lädt
// Schüsse, die der aktuellen Revision.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { CardProjection, ProjectedCard } from "@vereinsheim/shot-core/projection"

import type { CardState, Prisma, Scoring } from "@/generated/prisma/client"

import type { Db } from "../db"
import { shotFromRow, toMetricShot } from "./cards"

/** eine Scheibe für die Übersichten: Merkmale und Projektion */
export interface OverviewCard extends ProjectedCard {
  disciplineId: number
  familyId: number | null
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
  official: true,
  state: true,
  stand: true,
  disciplineId: true,
  familyId: true,
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
        official: row.official,
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

/** Seite einer Scheibe: die Scheibe mit den Schüssen ihrer aktuellen Revision in Abgabefolge; null, wenn es sie nicht gibt */
export async function cardWithShots(
  db: Db,
  cardId: string
): Promise<(PeriodCard & { revision: number; disciplineId: number }) | null> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      startedAt: true,
      kind: true,
      complete: true,
      flags: true,
      official: true,
      disciplineId: true,
      deletedAt: true,
      currentRevision: {
        select: { number: true, shots: { orderBy: { seq: "asc" } } },
      },
    },
  })
  if (!card || card.deletedAt || !card.currentRevision) return null
  return {
    id: card.id,
    startedAtMs: card.startedAt.getTime(),
    kind: card.kind,
    complete: card.complete,
    flags: card.flags,
    ...(card.official ? { official: card.official } : {}),
    disciplineId: card.disciplineId,
    revision: card.currentRevision.number,
    shots: card.currentRevision.shots.map(shotFromRow).map(toMetricShot),
  }
}
