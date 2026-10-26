// Aufträge, eine Scheibe per ID zu holen (die ID im Fuß des Ausdrucks), ohne Zustimmung per Sportpass. Der Schütze legt
// sie im Profil an; die Brücke liest die Scheibe (`GET /state`, `requests`) und schickt sie nur vom genannten Abend, das
// Einlesen prüft den Abend noch einmal. Mit dem ersten Stand hängt die Scheibe am Auftrag; erledigt ist er, wenn sie
// endgültig ist (bis dahin kommen weitere Schüsse nach). Der Heartbeat meldet, was die Brücke nicht holen kann.

import type { RequestOutcome } from "@vereinsheim/ingest-contract/api"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { CardRequestStatus } from "@/generated/prisma/client"

import type { Db } from "../db"
import { printedId } from "./id"
import { isRemovable, REMOVABLE_STATUSES } from "./status"

/** so viele offene Aufträge hat ein Konto höchstens */
export const MAX_OPEN_REQUESTS = 10
/** so lange wartet ein Auftrag auf die Anlage, so lange zeigt das Profil einen erledigten */
export const REQUEST_DAYS = 30
const DAY_MS = 86_400_000

/** die Anlage, an der der Schütze holt (eine je Installation, ADR-029; gibt es mehrere, die erste); null ohne */
export async function requestSiteId(db: Db): Promise<number | null> {
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  return site?.id ?? null
}

export type RequestResult =
  | { kind: "created" }
  /** die Scheibe liegt schon beim Schützen (`deleted`: im Papierkorb) */
  | { kind: "exists"; cardId: string; deleted: boolean }
  /** die Scheibe wartet schon in „Offen“ (erste Scheibe einer Sportpassnummer) */
  | { kind: "pending" }
  /** die Scheibe dieses Abends ist gelöscht oder als „nicht meine“ gemeldet: Spiegel holt sie nicht wieder */
  | { kind: "blocked" }
  /** die Scheibe an diesem Abend gehört einem anderen Konto */
  | { kind: "taken" }
  /** derselbe Auftrag ist schon offen */
  | { kind: "duplicate" }
  | { kind: "tooMany" }

/**
 * Einen Auftrag anlegen. Liegt die Scheibe dieses Abends schon in Spiegel, gibt es keinen: beim Schützen den Weg zu ihr,
 * bei einem anderen Konto nur, dass sie vergeben ist (ohne zu sagen, wem). Unter der Sperre der Kontozeile, damit zwei
 * gleichzeitige Anfragen die Grenze nicht überholen.
 */
export async function requestCard(
  db: Db,
  input: { userId: string; siteId: number; scheibenId: number; day: string; nowMs?: number }
): Promise<RequestResult> {
  const site = await db.site.findUniqueOrThrow({
    where: { id: input.siteId },
    select: { id: true, timeZone: true },
  })
  const cards = await db.card.findMany({
    where: { source: { siteId: site.id }, scheibenId: input.scheibenId },
    select: { id: true, ownerId: true, startedAt: true, deletedAt: true, ownerPending: true },
  })
  const sameEvening = cards.filter(
    (card) => eveningDay(card.startedAt.getTime(), site.timeZone) === input.day
  )
  const own = sameEvening.find((card) => card.ownerId === input.userId)
  if (own?.ownerPending) return { kind: "pending" }
  if (own) return { kind: "exists", cardId: own.id, deleted: own.deletedAt !== null }
  if (sameEvening.length) return { kind: "taken" }
  // eine Sperre oder ein Grabstein dieses Abends: Die Brücke hielte die Scheibe zurück, der Auftrag endete „gehalten“
  const blockedWhere = { source: { siteId: site.id }, scheibenId: input.scheibenId }
  const [tombstones, locks] = await Promise.all([
    db.tombstone.findMany({ where: blockedWhere, select: { startedAt: true } }),
    db.deleteLock.findMany({ where: blockedWhere, select: { startedAt: true } }),
  ])
  if (
    [...tombstones, ...locks].some(
      (b) => eveningDay(b.startedAt.getTime(), site.timeZone) === input.day
    )
  )
    return { kind: "blocked" }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`
    const open = await tx.cardRequest.findMany({
      where: { userId: input.userId, status: "open" },
      select: { siteId: true, scheibenId: true, day: true },
    })
    if (
      open.some(
        (r) => r.siteId === site.id && r.scheibenId === input.scheibenId && r.day === input.day
      )
    )
      return { kind: "duplicate" }
    if (open.length >= MAX_OPEN_REQUESTS) return { kind: "tooMany" }
    await tx.cardRequest.create({
      data: {
        userId: input.userId,
        siteId: site.id,
        scheibenId: input.scheibenId,
        day: input.day,
        ...(input.nowMs === undefined ? {} : { createdAt: new Date(input.nowMs) }),
      },
    })
    return { kind: "created" }
  })
}

/** einen eigenen, offenen Auftrag zurückziehen; false, wenn es keinen gibt (schon erledigt oder fremd) */
export async function withdrawRequest(
  db: Db,
  input: { userId: string; requestId: number; nowMs?: number }
): Promise<boolean> {
  const { count } = await db.cardRequest.updateMany({
    where: { id: input.requestId, userId: input.userId, status: "open" },
    data: { status: "withdrawn", closedAt: new Date(input.nowMs ?? Date.now()) },
  })
  return count === 1
}

/** einen eigenen, beendeten Auftrag ohne Scheibe entfernen (`isRemovable`); false, wenn es keinen solchen gibt */
export async function removeRequest(
  db: Db,
  input: { userId: string; requestId: number }
): Promise<boolean> {
  const { count } = await db.cardRequest.deleteMany({
    where: {
      id: input.requestId,
      userId: input.userId,
      status: { in: [...REMOVABLE_STATUSES] },
      cardId: null,
    },
  })
  return count === 1
}

/**
 * offene Aufträge nach `REQUEST_DAYS` Tagen: mit Scheibe erledigt (sie ist seither nicht endgültig geworden, etwa
 * ohne Heartbeat), ohne ohne Antwort der Anlage (`expired`: Brücke aus oder zu alt für Aufträge)
 */
export async function expireRequests(db: Db, nowMs = Date.now()): Promise<number> {
  const old = {
    status: "open" as const,
    createdAt: { lt: new Date(nowMs - REQUEST_DAYS * DAY_MS) },
  }
  const closedAt = new Date(nowMs)
  const [withCard, without] = await Promise.all([
    db.cardRequest.updateMany({
      where: { ...old, cardId: { not: null } },
      data: { status: "done", closedAt },
    }),
    db.cardRequest.updateMany({
      where: { ...old, cardId: null },
      data: { status: "expired", closedAt },
    }),
  ])
  return withCard.count + without.count
}

/** offene Aufträge der Anlage, deren Scheibe endgültig ist (der Heartbeat schaltet sie weiter): erledigt */
export async function finishRequests(db: Db, siteId: number, nowMs = Date.now()): Promise<number> {
  const { count } = await db.cardRequest.updateMany({
    where: { siteId, status: "open", card: { is: { state: "final" } } },
    data: { status: "done", closedAt: new Date(nowMs) },
  })
  return count
}

/** ein Auftrag im Profil */
export interface OwnRequest {
  id: number
  /** die ID wie auf dem Ausdruck */
  hex: string
  day: string
  status: CardRequestStatus
  /** die geholte Scheibe, solange sie sichtbar beim Schützen liegt; sonst null */
  cardId: string | null
  /** beendet ohne Scheibe (`isRemovable`); eine Scheibe im Papierkorb oder in „Offen“ zählt mit */
  removable: boolean
}

/** die eigenen Aufträge: offene und die der letzten `REQUEST_DAYS` Tage, neueste zuerst */
export async function ownRequests(
  db: Db,
  userId: string,
  nowMs = Date.now()
): Promise<OwnRequest[]> {
  await expireRequests(db, nowMs)
  const rows = await db.cardRequest.findMany({
    where: {
      userId,
      OR: [{ status: "open" }, { createdAt: { gte: new Date(nowMs - REQUEST_DAYS * DAY_MS) } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      scheibenId: true,
      day: true,
      status: true,
      card: { select: { id: true, ownerId: true, deletedAt: true, ownerPending: true } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    hex: printedId(row.scheibenId),
    day: row.day,
    status: row.status,
    cardId:
      row.card && row.card.ownerId === userId && !row.card.deletedAt && !row.card.ownerPending
        ? row.card.id
        : null,
    removable: isRemovable(row.status, row.card !== null),
  }))
}

/** was die Brücke holen soll: offene Aufträge aktiver Konten der Anlage mit ihrem Abend, älteste zuerst, höchstens `limit` */
export async function openRequestsOf(
  db: Db,
  siteId: number,
  { nowMs = Date.now(), limit = 1_000 }: { nowMs?: number; limit?: number } = {}
): Promise<{ id: number; scheibenId: number; day: string }[]> {
  await expireRequests(db, nowMs)
  return db.cardRequest.findMany({
    where: { siteId, status: "open", user: { isActive: true } },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, scheibenId: true, day: true },
  })
}

/** offene Aufträge der Anlage für diese ScheibenIDs, älteste zuerst (Einlesen) */
export async function openRequestsFor(db: Db, siteId: number, scheibenIds: readonly number[]) {
  if (!scheibenIds.length) return []
  return db.cardRequest.findMany({
    where: {
      siteId,
      status: "open",
      scheibenId: { in: [...new Set(scheibenIds)] },
      user: { isActive: true },
    },
    orderBy: { id: "asc" },
    select: { id: true, userId: true, scheibenId: true, day: true },
  })
}

/** einen offenen Auftrag schließen; ein schon geschlossener bleibt, wie er ist */
export async function closeRequest(
  db: Db,
  input: { id: number; status: Exclude<CardRequestStatus, "open">; cardId?: string; nowMs?: number }
): Promise<void> {
  await db.cardRequest.updateMany({
    where: { id: input.id, status: "open" },
    data: {
      status: input.status,
      closedAt: new Date(input.nowMs ?? Date.now()),
      ...(input.cardId ? { cardId: input.cardId } : {}),
    },
  })
}

/** die geholte Scheibe an einen offenen Auftrag hängen; er bleibt offen, bis sie endgültig ist (`finishRequests`) */
export async function attachRequestCard(db: Db, id: number, cardId: string): Promise<void> {
  await db.cardRequest.updateMany({ where: { id, status: "open" }, data: { cardId } })
}

/**
 * Was die Brücke meldet (`heartbeat.requestsDone`): nicht in der Ablage, von einem anderen Abend oder im Schützenhaus
 * gehalten schließt den Auftrag; `sent` nicht, das macht das Einlesen mit dem Stand. Nur offene Aufträge dieser Anlage
 * ohne Scheibe (eine schon geholte, die noch ergänzt wird, bleibt).
 */
export async function recordRequestOutcomes(
  db: Db,
  siteId: number,
  done: readonly { id: number; outcome: RequestOutcome }[],
  nowMs = Date.now()
): Promise<void> {
  for (const status of ["missing", "held", "mismatch"] as const) {
    const ids = done.filter((d) => d.outcome === status).map((d) => d.id)
    if (ids.length)
      await db.cardRequest.updateMany({
        where: { id: { in: ids }, siteId, status: "open", cardId: null },
        data: { status, closedAt: new Date(nowMs) },
      })
  }
}
