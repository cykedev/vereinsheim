// Aufträge, eine Scheibe per ID zu holen (die ID im Fuß des Ausdrucks), ohne Zustimmung per Sportpass. Der Schütze legt
// sie im Profil an; die Brücke liest die Scheibe (`GET /state`, `requests`), das Einlesen nimmt sie nur an, wenn ihr
// Beginn auf den genannten Abend fällt, und schließt den Auftrag. Der Heartbeat meldet, was die Brücke nicht holen kann.

import type { RequestOutcome } from "@vereinsheim/ingest-contract/api"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { CardRequestStatus } from "@/generated/prisma/client"

import type { Db } from "../db"
import { printedId } from "./id"

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

/** offene Aufträge, die länger als `REQUEST_DAYS` auf die Anlage warten: nicht gefunden */
export async function expireRequests(db: Db, nowMs = Date.now()): Promise<number> {
  const { count } = await db.cardRequest.updateMany({
    where: { status: "open", createdAt: { lt: new Date(nowMs - REQUEST_DAYS * DAY_MS) } },
    data: { status: "missing", closedAt: new Date(nowMs) },
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
  }))
}

/** was die Brücke holen soll: offene Aufträge aktiver Konten der Anlage, älteste zuerst, höchstens `limit` */
export async function openRequestsOf(
  db: Db,
  siteId: number,
  { nowMs = Date.now(), limit = 1_000 }: { nowMs?: number; limit?: number } = {}
): Promise<{ id: number; scheibenId: number }[]> {
  await expireRequests(db, nowMs)
  return db.cardRequest.findMany({
    where: { siteId, status: "open", user: { isActive: true } },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, scheibenId: true },
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

/**
 * Was die Brücke meldet (`heartbeat.requestsDone`): nicht in der Ablage oder im Schützenhaus gehalten schließt den
 * Auftrag; `sent` nicht, das schließt das Einlesen mit dem Stand. Nur offene Aufträge dieser Anlage.
 */
export async function recordRequestOutcomes(
  db: Db,
  siteId: number,
  done: readonly { id: number; outcome: RequestOutcome }[],
  nowMs = Date.now()
): Promise<void> {
  for (const status of ["missing", "held"] as const) {
    const ids = done.filter((d) => d.outcome === status).map((d) => d.id)
    if (ids.length)
      await db.cardRequest.updateMany({
        where: { id: { in: ids }, siteId, status: "open" },
        data: { status, closedAt: new Date(nowMs) },
      })
  }
}
