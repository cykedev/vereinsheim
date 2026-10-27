// Aufträge, eine Scheibe per ID zu holen (die ID im Fuß des Ausdrucks), ohne Zustimmung per Sportpass. Der Schütze legt
// sie unter „Scheibe holen“ an, zusammen mit einer Scheibe vom Ausdruck (`fetch-card`); die Brücke liest die Scheibe
// (`GET /state`, `requests`) und schickt sie nur vom genannten Abend, das Einlesen prüft den Abend und die Druckzeit noch
// einmal und füllt die Scheibe des Auftrags. Erledigt ist er, wenn sie gefüllt und endgültig ist (bis dahin kommen
// weitere Schüsse nach). Der Heartbeat meldet, was die Brücke nicht holen kann. Ältere Aufträge ohne Scheibe bekommen
// beim Einlesen eine neue Scheibe der Brücke.

import type { RequestOutcome } from "@vereinsheim/ingest-contract/api"
import type { CardRequestStatus, Prisma } from "@/generated/prisma/client"

import type { Db } from "../db"

/** so viele offene Aufträge hat ein Konto höchstens */
export const MAX_OPEN_REQUESTS = 10
/** so lange wartet ein Auftrag auf die Anlage */
export const REQUEST_DAYS = 30
const DAY_MS = 86_400_000

/** die Anlage, an der der Schütze holt (eine je Installation, ADR-029; gibt es mehrere, die erste); null ohne */
export async function requestSiteId(db: Db): Promise<number | null> {
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  return site?.id ?? null
}

/**
 * Ein Auftrag ist ungefüllt, solange seine Scheibe keine Quelle hat: keine Scheibe (ältere Aufträge) oder eine vom
 * Ausdruck, die noch auf die Brücke wartet. Alle Regeln der Aufträge unterscheiden danach, nicht nach `cardId`: Mit dem
 * Holen hat jeder neue Auftrag vom Anlegen an eine Scheibe, und eine Scheibe vom Ausdruck ist von Anfang an endgültig.
 */
export const UNFILLED = {
  OR: [{ cardId: null }, { card: { is: { sourceId: null } } }],
} satisfies Prisma.CardRequestWhereInput

/** die Scheibe des Auftrags hat Rohdaten der Brücke */
const FILLED = { card: { is: { sourceId: { not: null } } } } satisfies Prisma.CardRequestWhereInput

/**
 * einen eigenen, ungefüllten Auftrag beenden („Nicht mehr holen“, „Entfernen“): Er wird zurückgezogen, nie gelöscht, so
 * behält eine Scheibe aus einer getippten ID ihre ID. Scheibe und Ausdruck bleiben. false, wenn es keinen solchen gibt
 * (gefüllt, schon zurückgezogen oder geholt, fremd)
 */
export async function dismissRequest(
  db: Db,
  input: { userId: string; requestId: number; nowMs?: number }
): Promise<boolean> {
  const { count } = await db.cardRequest.updateMany({
    where: {
      id: input.requestId,
      userId: input.userId,
      status: { notIn: ["withdrawn", "done"] },
      ...UNFILLED,
    },
    data: { status: "withdrawn", closedAt: new Date(input.nowMs ?? Date.now()) },
  })
  return count === 1
}

/**
 * offene Aufträge nach `REQUEST_DAYS` Tagen: gefüllt erledigt (die Scheibe ist seither nicht endgültig geworden, etwa
 * ohne Heartbeat), ungefüllt ohne Antwort der Anlage (`expired`: Brücke aus oder zu alt für Aufträge)
 */
export async function expireRequests(db: Db, nowMs = Date.now()): Promise<number> {
  const old = {
    status: "open" as const,
    createdAt: { lt: new Date(nowMs - REQUEST_DAYS * DAY_MS) },
  }
  const closedAt = new Date(nowMs)
  const [filled, unfilled] = await Promise.all([
    db.cardRequest.updateMany({ where: { ...old, ...FILLED }, data: { status: "done", closedAt } }),
    db.cardRequest.updateMany({
      where: { ...old, ...UNFILLED },
      data: { status: "expired", closedAt },
    }),
  ])
  return filled.count + unfilled.count
}

/**
 * offene Aufträge der Anlage, deren Scheibe gefüllt und endgültig ist (der Heartbeat schaltet sie weiter): erledigt. Eine
 * Scheibe vom Ausdruck ist von Anfang an endgültig, ihr Auftrag wartet aber noch auf die Brücke.
 */
export async function finishRequests(db: Db, siteId: number, nowMs = Date.now()): Promise<number> {
  const { count } = await db.cardRequest.updateMany({
    where: { siteId, status: "open", card: { is: { state: "final", sourceId: { not: null } } } },
    data: { status: "done", closedAt: new Date(nowMs) },
  })
  return count
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
    select: {
      id: true,
      userId: true,
      scheibenId: true,
      day: true,
      cardId: true,
      card: {
        select: { sourceId: true, ownerId: true, printouts: { select: { printedAt: true } } },
      },
    },
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
 * gehalten schließt den Auftrag; `sent` nicht, das macht das Einlesen mit dem Stand. Nur offene, ungefüllte Aufträge
 * dieser Anlage (eine schon gefüllte Scheibe, die noch ergänzt wird, bleibt).
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
        where: { id: { in: ids }, siteId, status: "open", ...UNFILLED },
        data: { status, closedAt: new Date(nowMs) },
      })
  }
}
