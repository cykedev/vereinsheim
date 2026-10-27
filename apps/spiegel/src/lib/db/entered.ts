// Scheiben ohne Brücke schreiben ([[adr-033]]): der einzige Weg für Scheiben vom Ausdruck (Scan, Parser), von Hand und
// aus der Übernahme aus Treffsicher. Rohdaten schreibt nur `writeRevision`. Die Angaben gehören zur Revision (ADR-031):
// Eine geänderte Angabe ist eine neue Revision, gleiche Angaben ändern nur die Merkmale. Wer zugleich einen Ausdruck
// anhängt, ruft `writeEnteredCardIn` in derselben Transaktion.

import { plannedShotsOf, seriesShotsOf } from "@vereinsheim/shot-core/discipline"
import { FLAG_SUSPICIOUS } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"

import type { CardKind, CardOrigin, Prisma } from "@/generated/prisma/client"

import type { Db } from "../db"
import {
  checkDetails,
  checkImportKey,
  checkStand,
  detailsWriter,
  enteredScoring,
  isTimeMs,
  normalizePlace,
  type DetailsInput,
  type DetailsProblem,
  type EnteredOrigin,
  type NormalizedDetails,
} from "../entered/details"
import { detailFlags, isComplete, revisionCounts, verifyShots } from "../ingest/card-checks"
import { detailsHash, saveProjection, shotRows, toMetricShot } from "./cards"
import { lockCard } from "./purge"

type Tx = Prisma.TransactionClient

export interface EnteredCardInput {
  /** fehlt: neue Scheibe; sonst ändern */
  cardId?: string
  ownerId: string
  origin: EnteredOrigin
  disciplineId: number
  startedAtMs: number
  kind: CardKind
  /** nur beim Anlegen: die Art als Wahl des Schützen (`kindChoice`), damit sie bleibt, wenn die Brücke die Scheibe füllt */
  kindChoice?: CardKind
  /** fehlt: beim Ändern nicht anfassen; null leeren */
  place?: string | null
  /** nur beim Anlegen, nur aus Treffsicher */
  importKey?: string | null
  /** Standnummer, nur vom Ausdruck; fehlt: nicht anfassen */
  stand?: string | null
  details: DetailsInput
  reason: string
}

export type EnteredResult =
  | {
      kind: "saved"
      change: "created" | "revised" | "unchanged"
      cardId: string
      revisionId: bigint
      number: number
    }
  | { kind: "missing" }
  | { kind: "notEditable" }
  | { kind: "keyTaken" }
  | { kind: "invalid"; problem: DetailsProblem }

export const writeEnteredCard = (db: Db, input: EnteredCardInput) =>
  db.$transaction((tx) => writeEnteredCardIn(tx, input))

/** eine Revision mit ihren Angaben: Gesamtergebnis und Trefferlage an der Revision, Serien-Summen, Schüsse */
async function createDetailsRevision(
  tx: Tx,
  cardId: string,
  number: number,
  details: NormalizedDetails,
  hash: string,
  reason: string
): Promise<bigint> {
  const { total, center, series = [] } = details.sums ?? {}
  const { id } = await tx.cardRevision.create({
    data: {
      cardId,
      number,
      contentHash: hash,
      reason,
      totalRings: total?.rings ?? null,
      totalDecimalTenths: total?.decimalTenths ?? null,
      totalShots: total?.shots ?? null,
      centerXUm: center?.xUm ?? null,
      centerYUm: center?.yUm ?? null,
      centerShots: center?.shots ?? null,
    },
    select: { id: true },
  })
  if (series.length)
    await tx.seriesSum.createMany({ data: series.map((sum) => ({ revisionId: id, ...sum })) })
  await tx.shot.createMany({ data: shotRows(id, cardId, details.shots) })
  return id
}

/**
 * Eine Scheibe ohne Brücke anlegen oder ändern, in der Transaktion des Aufrufers: Disziplin (`FOR SHARE`), Angaben
 * prüfen (`checkDetails`), Gegenprobe gegen das Scheibenbild, Merkmale und Projektion wie beim Nachrechnen. Ändern darf
 * nur, wer nach `detailsWriter` darf, und nur der Besitzer einer sichtbaren Scheibe.
 */
export async function writeEnteredCardIn(tx: Tx, input: EnteredCardInput): Promise<EnteredResult> {
  const [discipline] = await tx.$queryRaw<
    {
      familyId: number | null
      targetId: string | null
      plannedShots: number | null
      seriesShots: number | null
      meytonId: number | null
      version: number
    }[]
  >`
    SELECT "familyId", "targetId", "plannedShots", "seriesShots", "meytonId", version
      FROM "Discipline" WHERE id = ${input.disciplineId} FOR SHARE`
  if (!discipline) return { kind: "missing" }

  if (!isTimeMs(input.startedAtMs)) return { kind: "invalid", problem: "startedAt" }
  const plannedShots = plannedShotsOf(discipline.meytonId, discipline.plannedShots)
  const checked = checkDetails(input.details, {
    plannedShots,
    seriesShots: seriesShotsOf(discipline.seriesShots, plannedShots),
  })
  if (!checked.ok) return { kind: "invalid", problem: checked.problem }
  const place = normalizePlace(input.place)
  if (!place.ok) return { kind: "invalid", problem: place.problem }
  const importKey = input.importKey ?? null
  const keyProblem =
    input.cardId !== undefined && importKey !== null
      ? "importKey"
      : checkImportKey(input.origin, importKey)
  if (keyProblem) return { kind: "invalid", problem: keyProblem }
  const standProblem = checkStand(input.origin, input.stand)
  if (standProblem) return { kind: "invalid", problem: standProblem }
  const stand = input.stand === undefined ? {} : { stand: input.stand }

  // die Gegenprobe wie beim Nachrechnen: Merkmale aus den Werten hat `checkDetails` gesetzt
  const targetId =
    discipline.targetId !== null && Object.hasOwn(TARGETS, discipline.targetId)
      ? (discipline.targetId as TargetId)
      : null
  const { suspicious, targetMismatch } = verifyShots(targetId, checked.details.shots)
  const details: NormalizedDetails = {
    ...checked.details,
    shots: checked.details.shots.map((shot, i) =>
      suspicious[i] ? { ...shot, flags: [...shot.flags, FLAG_SUSPICIOUS] } : shot
    ),
  }
  const counts = revisionCounts(details.shots, details.sums)
  const features = (origin: CardOrigin) => {
    const flags = detailFlags({ origin, ...counts, plannedShots, targetId, targetMismatch })
    return {
      origin,
      disciplineId: input.disciplineId,
      disciplineVersion: discipline.version,
      familyId: discipline.familyId,
      startedAt: new Date(input.startedAtMs),
      kind: input.kind,
      flags,
      complete: isComplete("final", flags) && counts.valued,
      standScoring: enteredScoring(details),
    }
  }
  const hash = detailsHash(details.shots, details.sums)
  const metricShots = details.shots.map(toMetricShot)

  let cardId = input.cardId
  if (cardId === undefined && importKey !== null) {
    // zwei Übernahmen desselben Schlüssels nacheinander: die zweite findet die Scheibe der ersten
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${importKey}))`
    const taken = await tx.card.findUnique({
      where: { importKey },
      select: { id: true, ownerId: true },
    })
    if (taken && taken.ownerId !== input.ownerId) return { kind: "keyTaken" }
    // eine wiederholte Übernahme ersetzt, statt zu verdoppeln
    cardId = taken?.id
  }

  if (cardId === undefined) {
    const { id } = await tx.card.create({
      data: {
        ...features(input.origin),
        sourceId: null,
        scheibenId: null,
        ownerId: input.ownerId,
        ownerPending: false,
        state: "final",
        place: place.place ?? null,
        importKey,
        ...stand,
        ...(input.kindChoice ? { kindChoice: input.kindChoice } : {}),
      },
      select: { id: true },
    })
    const revisionId = await createDetailsRevision(tx, id, 1, details, hash, input.reason)
    await tx.card.update({ where: { id }, data: { currentRevisionId: revisionId } })
    await saveProjection(tx, id, revisionId, metricShots, details.sums)
    return { kind: "saved", change: "created", cardId: id, revisionId, number: 1 }
  }

  if (!(await lockCard(tx, cardId))) return { kind: "missing" }
  const card = await tx.card.findFirst({
    where: { id: cardId, ownerId: input.ownerId, deletedAt: null, ownerPending: false },
    select: {
      origin: true,
      currentRevision: { select: { id: true, number: true, contentHash: true } },
    },
  })
  if (!card) return { kind: "missing" }
  const next = detailsWriter(card.origin, input.origin)
  if (next === null) return { kind: "notEditable" }
  await tx.card.update({
    where: { id: cardId },
    data: {
      ...features(next),
      ...stand,
      ...(place.place === undefined ? {} : { place: place.place }),
    },
  })
  const current = card.currentRevision
  if (current && current.contentHash === hash)
    return {
      kind: "saved",
      change: "unchanged",
      cardId,
      revisionId: current.id,
      number: current.number,
    }
  const number = (current?.number ?? 0) + 1
  const revisionId = await createDetailsRevision(tx, cardId, number, details, hash, input.reason)
  await tx.card.update({ where: { id: cardId }, data: { currentRevisionId: revisionId } })
  await saveProjection(tx, cardId, revisionId, metricShots, details.sums)
  return { kind: "saved", change: "revised", cardId, revisionId, number }
}
