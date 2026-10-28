// Lesen für „Ergebnis eintragen“ ([[adr-033]]): die Disziplin mit dem, was das Formular braucht, die eigenen Orte als
// Vorschläge und eine eingetragene Scheibe zum Ändern. Nur eigene Scheiben, wie die Seite einer Scheibe.

import { plannedShotsOf, seriesShotsOf } from "@vereinsheim/shot-core/discipline"
import { formatIsoDate, formatTimeOfDay } from "@vereinsheim/lib/format"

import type { CardKind } from "@/generated/prisma/client"

import type { Db } from "../db"
import { kindOfRow } from "../db/reads"
import { VISIBLE_CARD } from "../db/visible"
import { detailsToForm, type FormDiscipline, type StoredDetails } from "./form"

/** so viele Orte schlägt das Feld „Ort“ vor */
const PLACES = 20

export interface EntryDiscipline extends FormDiscipline {
  id: number
  name: string
  family: string
}

const DISCIPLINE_SELECT = {
  id: true,
  name: true,
  meytonId: true,
  plannedShots: true,
  seriesShots: true,
  officialScoring: true,
  family: { select: { name: true } },
} as const

function entryDisciplineOf(row: {
  id: number
  name: string
  meytonId: number | null
  plannedShots: number | null
  seriesShots: number | null
  officialScoring: "decimal" | "rings" | null
  family: { name: string } | null
}): EntryDiscipline {
  const plannedShots = plannedShotsOf(row.meytonId, row.plannedShots)
  return {
    id: row.id,
    name: row.name,
    family: row.family?.name ?? "",
    plannedShots,
    seriesShots: seriesShotsOf(row.seriesShots, plannedShots),
    officialScoring: row.officialScoring,
  }
}

/** eine wählbare Disziplin der Anlage (wie im Blatt „Neue Scheibe“: eingeordnet, Familie, Scheibenbild); sonst null */
export async function entryDiscipline(
  db: Db,
  { siteId, disciplineId }: { siteId: number; disciplineId: number }
): Promise<EntryDiscipline | null> {
  const row = await db.discipline.findFirst({
    where: {
      id: disciplineId,
      siteId,
      confirmedAt: { not: null },
      ignoredAt: null,
      familyId: { not: null },
      targetId: { not: null },
    },
    select: DISCIPLINE_SELECT,
  })
  return row ? entryDisciplineOf(row) : null
}

/** die eigenen Orte, zuletzt genutzte zuerst, jeder einmal (ohne Groß- und Kleinschreibung) */
export async function ownPlaces(db: Db, ownerId: string): Promise<string[]> {
  const rows = await db.card.findMany({
    where: { ownerId, deletedAt: null, place: { not: null } },
    select: { place: true },
    orderBy: { startedAt: "desc" },
    take: 500,
  })
  const seen = new Set<string>()
  const places: string[] = []
  for (const { place } of rows) {
    const key = place!.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    places.push(place!)
    if (places.length === PLACES) break
  }
  return places
}

export interface CardForEdit {
  id: string
  discipline: EntryDiscipline
  /** die Art der Quelle (`Card.kind`), die `writeEnteredCard` wieder schreibt */
  kind: CardKind
  /** die Art, wie die Seite sie zeigt */
  shownKind: CardKind
  day: string
  time: string
  place: string
  stored: StoredDetails
}

/**
 * Eine eigene, sichtbare, eingetragene Scheibe (von Hand oder aus Treffsicher) mit den Angaben ihrer aktuellen
 * Revision; sonst null. Tag und Uhrzeit in der Anzeige-Zone, ohne bekannte Uhrzeit leer.
 */
export async function cardForEdit(
  db: Db,
  { cardId, ownerId, timeZone }: { cardId: string; ownerId: string; timeZone: string }
): Promise<CardForEdit | null> {
  const card = await db.card.findFirst({
    where: { id: cardId, ownerId, ...VISIBLE_CARD, origin: { in: ["manual", "treffsicher"] } },
    select: {
      id: true,
      kind: true,
      kindChoice: true,
      ranking: { select: { kind: true } },
      startedAt: true,
      timeUnknown: true,
      place: true,
      discipline: { select: DISCIPLINE_SELECT },
      currentRevision: {
        select: {
          totalRings: true,
          totalDecimalTenths: true,
          totalShots: true,
          centerXUm: true,
          centerYUm: true,
          seriesSums: { orderBy: { series: "asc" } },
          shots: {
            orderBy: { seq: "asc" },
            select: {
              series: true,
              ring: true,
              decimalTenths: true,
              stellung: true,
              xUm: true,
              firedAt: true,
              innerTen: true,
            },
          },
        },
      },
    },
  })
  if (!card) return null
  const revision = card.currentRevision
  const total =
    revision && revision.totalShots !== null
      ? {
          shots: revision.totalShots,
          rings: revision.totalRings,
          decimalTenths: revision.totalDecimalTenths,
        }
      : null
  const center =
    revision && revision.centerXUm !== null && revision.centerYUm !== null
      ? { xUm: revision.centerXUm, yUm: revision.centerYUm }
      : null
  return {
    id: card.id,
    discipline: entryDisciplineOf(card.discipline),
    kind: card.kind,
    shownKind: kindOfRow(card, false),
    day: formatIsoDate(card.startedAt, timeZone),
    time: card.timeUnknown ? "" : formatTimeOfDay(card.startedAt, timeZone),
    place: card.place ?? "",
    stored: {
      shots: (revision?.shots ?? []).map((shot) => ({
        series: shot.series,
        ring: shot.ring,
        decimalTenths: shot.decimalTenths,
        probe: shot.stellung === 0,
        more: shot.xUm !== null || shot.firedAt !== null || shot.innerTen === true,
      })),
      series: (revision?.seriesSums ?? []).map((sum) => ({
        series: sum.series,
        shots: sum.shots,
        rings: sum.rings,
        decimalTenths: sum.decimalTenths,
      })),
      total,
      center,
    },
  }
}

/** was der Kasten „Diese Scheibe“ zu Eintrag und Ort zeigt */
export type CardEntryInfo =
  | { kind: "entered"; from: "manual" | "treffsicher"; editable: boolean }
  | { kind: "place"; place: string | null; places: string[] }

/**
 * Eintrag und Ort einer eigenen, sichtbaren Scheibe: eingetragen (änderbar, wenn das Formular alle Angaben zeigen
 * kann), vom Ausdruck nur der Ort mit den eigenen Orten als Vorschlag; von der Anlage nichts (ihr Ort ist die Anlage)
 */
export async function cardEntryInfo(
  db: Db,
  { cardId, ownerId, timeZone }: { cardId: string; ownerId: string; timeZone: string }
): Promise<CardEntryInfo | null> {
  const row = await db.card.findFirst({
    where: { id: cardId, ownerId, ...VISIBLE_CARD },
    select: { origin: true, place: true },
  })
  if (!row || row.origin === "raw") return null
  if (row.origin === "pdf")
    return { kind: "place", place: row.place, places: await ownPlaces(db, ownerId) }
  const card = await cardForEdit(db, { cardId, ownerId, timeZone })
  return {
    kind: "entered",
    from: row.origin,
    editable: card !== null && detailsToForm(card.stored, card.discipline, card) !== null,
  }
}
