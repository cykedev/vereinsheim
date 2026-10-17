import { requireAdmin } from "@/lib/auth-helpers"
import { consentStatus, sportpassSummary } from "@/lib/consent/status"
import { db } from "@/lib/db"
import { PENDING_CARD, SHOWN_DISCIPLINE, VISIBLE_CARD } from "@/lib/db/visible"

/** so lange nach der Bestätigung ohne jede Scheibe gilt eine Zustimmung als auffällig */
const QUIET_AFTER_MS = 14 * 86_400_000

/** ein Konto, wie die Verwaltung es zeigt (ohne Passwort) */
export interface UserSummary {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "USER"
  isActive: boolean
}

const SELECT = { id: true, name: true, email: true, role: true, isActive: true } as const

/**
 * ein Konto in der Liste, dazu der Stand seines Sportpasses in einem Wort und Zahlen ohne Inhalt:
 * wie viele Scheiben, wann die letzte begann, wie viele in „Offen“ warten. Keine Ergebnisse, keine Disziplinen.
 */
export interface UserListItem extends UserSummary {
  sportpass: string
  /** sichtbare Scheiben (ohne Papierkorb und ohne Wartende) */
  cards: number
  /** Beginn der jüngsten sichtbaren Scheibe (ISO), null ohne */
  lastCardAt: string | null
  /** Scheiben, die in „Offen“ auf die Bestätigung der ersten warten */
  waiting: number
  /** eine aktive Zustimmung seit mehr als 14 Tagen, aber keine einzige Scheibe: Nummer oder Brücke prüfen */
  quiet: boolean
}

/** alle Konten, aktive zuerst, nach Name und E-Mail (nur für Admins, prüft selbst) */
export async function getUsers(nowMs = Date.now()): Promise<UserListItem[]> {
  await requireAdmin()
  const users = await db.user.findMany({
    select: {
      ...SELECT,
      consents: { select: { confirmedAt: true, rejectedAt: true, returnedAt: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
  })
  // je Konto zählen, eine Abfrage je Zahl statt einer je Konto; nie Schüsse oder Ergebnisse
  const ownerIds = users.map((u) => u.id)
  const [visible, pending, trashed, ignored, locks, rejected] = await Promise.all([
    db.card.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: ownerIds }, ...VISIBLE_CARD },
      _count: { _all: true },
      _max: { startedAt: true },
    }),
    db.card.groupBy({
      by: ["ownerId"],
      // wie „Offen“: ohne ignorierte Disziplinen
      where: { ownerId: { in: ownerIds }, ...PENDING_CARD, ...SHOWN_DISCIPLINE },
      _count: { _all: true },
    }),
    // Spuren für den Hinweis: Wer gelöscht oder zurückgewiesen hat, bekommt Scheiben
    db.card.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: ownerIds }, deletedAt: { not: null } },
    }),
    // angekommen, aber in einer ignorierten Disziplin: auch das sind Scheiben, die Brücke läuft
    db.card.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: ownerIds }, discipline: { ignoredAt: { not: null } } },
    }),
    db.deleteLock.groupBy({ by: ["userId"], where: { userId: { in: ownerIds } } }),
    db.tombstone.groupBy({ by: ["userId"], where: { userId: { in: ownerIds } } }),
  ])
  const visibleOf = new Map(visible.map((v) => [v.ownerId, v]))
  const waitingOf = new Map(pending.map((p) => [p.ownerId, p._count._all]))
  const traced = new Set<string | null>([
    ...trashed.map((t) => t.ownerId),
    ...ignored.map((t) => t.ownerId),
    ...locks.map((l) => l.userId),
    ...rejected.map((r) => r.userId),
  ])
  return users.map(({ consents, ...user }) => {
    const statuses = consents.map(consentStatus)
    const sportpass = sportpassSummary(statuses)
    const counted = visibleOf.get(user.id)
    const cards = counted?._count._all ?? 0
    const waiting = waitingOf.get(user.id) ?? 0
    const longConfirmed = consents.some(
      (c, i) => statuses[i] === "active" && c.confirmedAt!.getTime() < nowMs - QUIET_AFTER_MS
    )
    // ein deaktiviertes Konto bekommt nichts, auch mit aktiver Zustimmung
    return {
      ...user,
      sportpass:
        user.isActive || sportpass === "kein Sportpass" ? sportpass : `${sportpass} · ruht`,
      cards,
      lastCardAt: counted?._max.startedAt?.toISOString() ?? null,
      waiting,
      quiet: user.isActive && longConfirmed && cards === 0 && waiting === 0 && !traced.has(user.id),
    }
  })
}

export async function getUser(id: string): Promise<UserSummary | null> {
  await requireAdmin()
  return db.user.findUnique({ where: { id }, select: SELECT })
}
