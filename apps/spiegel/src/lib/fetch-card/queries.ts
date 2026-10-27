// Scheibe holen ([[spiegel-assignment]], „Der QR-Weg im Detail“): Kamera, Link, PDF und getippte ID gehen gleich. Liegt
// die eigene Scheibe des Abends schon in Spiegel, öffnet Spiegel sie (ein PDF hängt nur an, SF-43). Sonst wählt der
// Schütze Disziplin und Art (vorbelegt mit der Disziplin aus dem Kopf des Ausdrucks); die Scheibe entsteht sofort vom
// Ausdruck (Herkunft `pdf`, mit seinen Werten, wenn der Leser sie stimmig fand), an ihr hängt ein Auftrag an die Brücke,
// die sie beim Einlesen füllt. Ausdrückliches Holen hebt nur die eigene Löschsperre auf und holt aus dem
// Papierkorb zurück; Grabsteine und Sperren anderer Konten bleiben.

import { zonedWallTimeMs } from "@vereinsheim/lib/format"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { CardKind, CardRequestStatus, Prisma } from "@/generated/prisma/client"

import { printedId } from "../card-requests/id"
import { expireRequests, MAX_OPEN_REQUESTS, UNFILLED } from "../card-requests/queries"
import { requestShown } from "../card-requests/status"
import type { Db } from "../db"
import { writeEnteredCardIn } from "../db/entered"
import { lockCard } from "../db/purge"
import { kindOfRow } from "../db/reads"
import { trashEndsAt } from "../db/trash"
import { VISIBLE_CARD } from "../db/visible"
import { applyPrintoutValues } from "../printouts/apply"
import { attachPrintout, markPrintoutValues } from "../printouts/queries"
import type { StoredPrintout } from "../printouts/store"
import { detailsFromReading } from "../printouts/values"

/** eine Disziplin, die der Schütze für eine neue Scheibe wählen kann */
export interface NewCardOption {
  id: number
  name: string
  family: string
}

/** Disziplin und Art einer neuen Scheibe */
export interface NewCardChoice {
  disciplineId: number
  kind: CardKind
}

/** eingeordnete Disziplinen der Anlage: bestätigt, nicht ignoriert, mit Familie und Scheibenbild */
const choosable = (siteId: number) =>
  ({
    siteId,
    confirmedAt: { not: null },
    ignoredAt: null,
    familyId: { not: null },
    targetId: { not: null },
  }) as const

const knownTarget = (targetId: string | null) =>
  targetId !== null && Object.hasOwn(TARGETS, targetId)

/**
 * Wahl für eine neue Scheibe: die eingeordneten Disziplinen der Anlage nach Familie und Name, vorbelegt mit Disziplin und
 * Art der jüngsten sichtbaren Scheibe (die Disziplin nur, wenn sie zur Wahl steht); ohne Scheibe Training
 */
export async function newCardChoices(
  db: Db,
  { userId, siteId }: { userId: string; siteId: number }
): Promise<{ options: NewCardOption[]; preset: { disciplineId: number | null; kind: CardKind } }> {
  const rows = await db.discipline.findMany({
    where: choosable(siteId),
    select: { id: true, name: true, targetId: true, family: { select: { name: true } } },
    orderBy: [{ family: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  })
  const options = rows
    .filter((row) => knownTarget(row.targetId))
    .map((row) => ({ id: row.id, name: row.name, family: row.family?.name ?? "" }))
  const last = await db.card.findFirst({
    where: { ownerId: userId, ...VISIBLE_CARD },
    orderBy: { startedAt: "desc" },
    select: {
      disciplineId: true,
      kind: true,
      kindChoice: true,
      ranking: { select: { kind: true } },
    },
  })
  return {
    options,
    preset: {
      disciplineId: options.some((o) => o.id === last?.disciplineId) ? last!.disciplineId : null,
      kind: last ? kindOfRow(last, false) : "training",
    },
  }
}

/**
 * Die Disziplin aus dem Kopf des Ausdrucks für die Vorbelegung: unter den wählbaren genau eine mit wörtlich diesem Namen,
 * sonst null (nie raten)
 */
export async function headerDisciplineId(
  db: Db | Prisma.TransactionClient,
  { siteId, name }: { siteId: number; name: string | null }
): Promise<number | null> {
  if (name === null || name.trim() === "") return null
  const rows = await db.discipline.findMany({
    where: { ...choosable(siteId), name },
    select: { id: true, targetId: true },
  })
  const known = rows.filter((row) => knownTarget(row.targetId))
  return known.length === 1 ? known[0].id : null
}

export interface FetchInput {
  userId: string
  siteId: number
  scheibenId: number
  /** der Abend (`YYYY-MM-DD`): aus der Druckzeit oder getippt */
  day: string
  /** der gespeicherte Ausdruck; null bei getippter ID */
  file: StoredPrintout | null
  /** Disziplin und Art für eine neue Scheibe; null: erst fragen */
  choice: NewCardChoice | null
  nowMs?: number
}

export type FetchResult =
  /** die eigene Scheibe des Abends; `attached`: der Ausdruck hängt jetzt an ihr */
  | { kind: "opened"; cardId: string; attached: boolean }
  /** die eigene Scheibe lag im Papierkorb und ist zurück */
  | { kind: "restored"; cardId: string }
  /** die eigene Scheibe wartet in „Offen“ */
  | { kind: "pending" }
  /** neu: erst Disziplin und Art wählen; `relifts`: Der Schütze hatte sie gelöscht, Holen hebt die Sperre auf */
  | { kind: "choose"; relifts: boolean }
  /** neu angelegt; `values`: mit den Werten vom Ausdruck */
  | { kind: "created"; cardId: string; relifted: boolean; values: boolean }
  /** die Scheibe des Abends gehört einem anderen Konto */
  | { kind: "taken" }
  /** ein Grabstein oder die Sperre eines anderen Kontos an diesem Abend */
  | { kind: "blocked" }
  | { kind: "tooMany" }
  /** die gewählte Disziplin steht nicht zur Wahl */
  | { kind: "notAllowed" }
  /** die eigene Scheibe lag länger als 30 Tage im Papierkorb */
  | { kind: "trashExpired" }

/** 12 Uhr des Tags in der Zone der Anlage: sicher im Abend, der um 4 Uhr beginnt */
function noonOf(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number)
  return zonedWallTimeMs(Date.UTC(y, m - 1, d, 12), timeZone)
}

const OWN_SELECT = {
  id: true,
  origin: true,
  sourceId: true,
  deletedAt: true,
  ownerPending: true,
  startedAt: true,
} as const

type Tx = Prisma.TransactionClient

/**
 * Die eigene Scheibe eines Abends: zuerst als Scheibe der Brücke (Quelle, ScheibenID), dann als eigene Scheibe vom
 * Ausdruck mit einem Auftrag dieser ID und dieses Tags, dann über einen Ausdruck dieser ID. Dazu alle Scheiben der Brücke
 * mit dieser ID an diesem Abend (auch fremde).
 */
export async function ownCardOfEvening(
  tx: Tx,
  input: { userId: string; siteId: number; scheibenId: number; day: string; timeZone: string }
) {
  const { userId, siteId, scheibenId, day, timeZone } = input
  const sameEvening = (at: Date) => eveningDay(at.getTime(), timeZone) === day
  const footerId = printedId(scheibenId)
  const bridgeCards = (
    await tx.card.findMany({
      where: { source: { siteId }, scheibenId },
      orderBy: [{ cycle: "desc" }, { block: "desc" }],
      select: { ...OWN_SELECT, ownerId: true },
    })
  ).filter((card) => sameEvening(card.startedAt))
  const own =
    bridgeCards.find((card) => card.ownerId === userId) ??
    (await tx.card.findFirst({
      where: {
        ownerId: userId,
        sourceId: null,
        origin: "pdf",
        requests: { some: { siteId, scheibenId, day } },
      },
      orderBy: { createdAt: "desc" },
      select: OWN_SELECT,
    })) ??
    (
      await tx.card.findMany({
        where: { ownerId: userId, printouts: { some: { footerId } } },
        orderBy: { createdAt: "desc" },
        select: OWN_SELECT,
      })
    ).find((card) => sameEvening(card.startedAt)) ??
    null
  return { own, bridgeCards }
}

/**
 * Die Angaben einer neuen Scheibe aus dem Ausdruck: stimmt die Lesung mit dem Scheibenbild der Disziplin, ihre Werte
 * und die Standnummer; sonst keine (`inconsistent`, wenn der Ausdruck eine Lesung hatte)
 */
export function newCardValues(file: StoredPrintout | null, targetId: string | null) {
  const reading = file?.values.reading ?? null
  if (reading === null) return { details: {}, stand: undefined, inconsistent: false }
  const result = detailsFromReading(
    reading,
    targetId !== null && Object.hasOwn(TARGETS, targetId) ? (targetId as TargetId) : null
  )
  return result.ok
    ? { details: result.details, stand: result.stand, inconsistent: false }
    : { details: {}, stand: undefined, inconsistent: true }
}

/**
 * Eine Scheibe holen, in einer Transaktion unter der Sperre der Kontozeile (zwei gleichzeitige Holen derselben Scheibe
 * ergeben eine; `FOR NO KEY UPDATE`, damit das Einlesen beim Anlegen einer Scheibe des Kontos über den Fremdschlüssel
 * nicht über Kreuz wartet). Die eigene Scheibe des Abends findet Spiegel zuerst als Scheibe der Brücke (Quelle, ScheibenID), dann als
 * eigene Scheibe vom Ausdruck mit einem Auftrag dieser ID und dieses Tags, dann über einen Ausdruck dieser ID. Ohne Wahl
 * schreibt eine neue Scheibe nichts (`choose`); die Seite fragt und ruft noch einmal.
 */
export async function fetchCard(db: Db, input: FetchInput): Promise<FetchResult> {
  const { userId, siteId, scheibenId, day, file, choice } = input
  const nowMs = input.nowMs ?? Date.now()
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR NO KEY UPDATE`
    const { timeZone } = await tx.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { timeZone: true },
    })
    const sameEvening = (at: Date) => eveningDay(at.getTime(), timeZone) === day
    const { own, bridgeCards } = await ownCardOfEvening(tx, {
      userId,
      siteId,
      scheibenId,
      day,
      timeZone,
    })

    const openRequestOf = (cardId: string) =>
      tx.cardRequest.findFirst({ where: { cardId, status: "open" }, select: { id: true } })
    const overLimit = async () =>
      (await tx.cardRequest.count({ where: { userId, status: "open", ...UNFILLED } })) >=
      MAX_OPEN_REQUESTS
    const attach = (cardId: string) => (file ? attachPrintout(tx, file, cardId) : null)
    /** eine Scheibe vom Ausdruck ohne Brücke bekommt die Werte ihrer Ausdrucke */
    const applyValues = async (card: { id: string; origin: string; sourceId: number | null }) => {
      if (file && card.origin === "pdf" && card.sourceId === null)
        await applyPrintoutValues(tx, card.id)
    }

    if (own) {
      // Löschen, Wiederherstellen und „Nicht meine“ ändern die Scheibe unter ihrer Sperre: den Zustand erst danach lesen
      const card = (await lockCard(tx, own.id))
        ? await tx.card.findFirst({ where: { id: own.id, ownerId: userId }, select: OWN_SELECT })
        : null
      if (!card) throw new Error("Scheibe während des Holens entfernt")
      // eine eigene Scheibe vom Ausdruck ohne Werte und ohne offenen Auftrag (zurückgezogen, nicht gefunden): ein neuer
      const needsRequest =
        card.sourceId === null && card.origin === "pdf" && !(await openRequestOf(card.id))
      const request = () =>
        tx.cardRequest.create({
          data: { userId, siteId, scheibenId, day, cardId: card.id, createdAt: new Date(nowMs) },
        })
      if (card.deletedAt) {
        if (trashEndsAt(card.deletedAt).getTime() <= nowMs) return { kind: "trashExpired" }
        if (needsRequest && (await overLimit())) return { kind: "tooMany" }
        await tx.card.update({ where: { id: card.id }, data: { deletedAt: null } })
        await attach(card.id)
        await applyValues(card)
        if (needsRequest) await request()
        return { kind: "restored", cardId: card.id }
      }
      if (card.ownerPending) {
        await attach(card.id)
        return { kind: "pending" }
      }
      if (needsRequest && (await overLimit())) return { kind: "tooMany" }
      await attach(card.id)
      await applyValues(card)
      if (needsRequest) await request()
      return { kind: "opened", cardId: card.id, attached: file !== null }
    }

    if (bridgeCards.length) return { kind: "taken" }
    const blockedWhere = { source: { siteId }, scheibenId }
    const [tombstones, locks] = await Promise.all([
      tx.tombstone.findMany({ where: blockedWhere, select: { startedAt: true } }),
      tx.deleteLock.findMany({
        where: blockedWhere,
        select: { id: true, userId: true, startedAt: true },
      }),
    ])
    const eveningLocks = locks.filter((lock) => sameEvening(lock.startedAt))
    if (
      tombstones.some((t) => sameEvening(t.startedAt)) ||
      eveningLocks.some((lock) => lock.userId !== userId)
    )
      return { kind: "blocked" }
    const relifts = eveningLocks.length > 0
    if (!choice) return { kind: "choose", relifts }

    const [discipline] = await tx.$queryRaw<{ targetId: string | null }[]>`
      SELECT "targetId" FROM "Discipline"
       WHERE id = ${choice.disciplineId} AND "siteId" = ${siteId} AND "confirmedAt" IS NOT NULL
         AND "ignoredAt" IS NULL AND "familyId" IS NOT NULL AND "targetId" IS NOT NULL
       FOR SHARE`
    if (!discipline || !knownTarget(discipline.targetId)) return { kind: "notAllowed" }
    // ein älterer offener Auftrag ohne Scheibe für dieselbe ID und denselben Tag bekommt die neue Scheibe
    const legacy = await tx.cardRequest.findFirst({
      where: { userId, siteId, scheibenId, day, status: "open", cardId: null },
      orderBy: { id: "asc" },
      select: { id: true },
    })
    if (!legacy && (await overLimit())) return { kind: "tooMany" }

    if (relifts)
      await tx.deleteLock.deleteMany({ where: { id: { in: eveningLocks.map((lock) => lock.id) } } })
    const values = newCardValues(file, discipline.targetId)
    const write = (withValues: boolean) =>
      writeEnteredCardIn(tx, {
        ownerId: userId,
        origin: "pdf",
        disciplineId: choice.disciplineId,
        startedAtMs: file?.printedAt.getTime() ?? noonOf(day, timeZone),
        kind: choice.kind,
        kindChoice: choice.kind,
        details: withValues ? values.details : {},
        ...(withValues && values.stand !== undefined ? { stand: values.stand } : {}),
        reason: "printout",
      })
    const tried = Object.keys(values.details).length > 0
    let saved = await write(tried)
    // Angaben, die die Disziplin nicht nimmt, zählen wie ein Widerspruch: die Scheibe ohne Werte
    const refused = tried && saved.kind === "invalid"
    if (refused) saved = await write(false)
    if (saved.kind !== "saved") throw new Error(`Scheibe vom Ausdruck: ${saved.kind}`)
    const printoutId = await attach(saved.cardId)
    if (printoutId && (values.inconsistent || refused))
      await markPrintoutValues(tx, printoutId, "inconsistent")
    // die Bedingung im Befehl: Einlesen und „Nicht mehr holen“ nehmen die Sperre der Kontozeile nicht (§9)
    const adopted = legacy
      ? await tx.cardRequest.updateMany({
          where: { id: legacy.id, status: "open", cardId: null },
          data: { cardId: saved.cardId },
        })
      : { count: 0 }
    if (adopted.count !== 1)
      await tx.cardRequest.create({
        data: { userId, siteId, scheibenId, day, cardId: saved.cardId, createdAt: new Date(nowMs) },
      })
    return {
      kind: "created",
      cardId: saved.cardId,
      relifted: relifts,
      values: tried && !refused,
    }
  })
}

/** ein älterer offener Auftrag ohne Scheibe, wie „Scheibe holen“ ihn zeigt */
export interface LegacyRequest {
  id: number
  hex: string
  day: string
}

/** die offenen Aufträge des Kontos ohne Scheibe (vor „Scheibe holen“ angelegt), neueste zuerst */
export async function legacyRequests(
  db: Db,
  userId: string,
  nowMs = Date.now()
): Promise<LegacyRequest[]> {
  await expireRequests(db, nowMs)
  const rows = await db.cardRequest.findMany({
    where: { userId, status: "open", cardId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, scheibenId: true, day: true },
  })
  return rows.map((row) => ({ id: row.id, hex: printedId(row.scheibenId), day: row.day }))
}

/** was der Kasten „Diese Scheibe“ über Ausdruck und Holen zeigt */
export interface CardFetchInfo {
  /** die ID vom Ausdruck: der Brücke, sonst des jüngsten Ausdrucks, sonst des jüngsten Auftrags; null ohne */
  hex: string | null
  /**
   * die Ausdrucke in der Folge des Anhängens; `unreadable`: an einer Scheibe vom Ausdruck ohne Brücke konnte Spiegel
   * seine Werte nicht übernehmen (Widerspruch oder nicht lesbar)
   */
  printouts: { id: string; printedAtMs: number | null; unreadable: boolean }[]
  /** der jüngste Auftrag, wenn die Seite ihn zeigt (`requestShown`) */
  request: {
    id: number
    status: CardRequestStatus
    filled: boolean
    hex: string
    day: string
  } | null
}

/** Ausdruck und Holen einer eigenen, sichtbaren Scheibe; null, wenn es sie für das Konto nicht gibt */
export async function cardFetchInfo(
  db: Db,
  { cardId, ownerId }: { cardId: string; ownerId: string }
): Promise<CardFetchInfo | null> {
  const card = await db.card.findFirst({
    where: { id: cardId, ownerId, ...VISIBLE_CARD },
    select: {
      sourceId: true,
      scheibenId: true,
      origin: true,
      printouts: {
        orderBy: [{ storedAt: "asc" }, { id: "asc" }],
        select: { id: true, printedAt: true, footerId: true, valuesStatus: true },
      },
      requests: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { id: true, status: true, scheibenId: true, day: true },
      },
    },
  })
  if (!card) return null
  const filled = card.sourceId !== null
  const latestPrintout = card.printouts
    .filter((p) => p.footerId)
    .sort((a, b) => (b.printedAt?.getTime() ?? 0) - (a.printedAt?.getTime() ?? 0))[0]
  const [latestRequest] = card.requests
  const hex =
    card.sourceId !== null && card.scheibenId !== null
      ? printedId(card.scheibenId)
      : (latestPrintout?.footerId ?? (latestRequest ? printedId(latestRequest.scheibenId) : null))
  return {
    hex,
    printouts: card.printouts.map((p) => ({
      id: p.id,
      printedAtMs: p.printedAt?.getTime() ?? null,
      unreadable:
        card.origin === "pdf" &&
        card.sourceId === null &&
        (p.valuesStatus === "inconsistent" || p.valuesStatus === "unreadable"),
    })),
    request:
      latestRequest && requestShown(latestRequest.status, filled)
        ? {
            id: latestRequest.id,
            status: latestRequest.status,
            filled,
            hex: printedId(latestRequest.scheibenId),
            day: latestRequest.day,
          }
        : null,
  }
}
