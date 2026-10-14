import { formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { NOT_MINE } from "@/lib/db/purge"

import { consentStatus, consentStatusText, type ConsentStatus } from "./status"

// Zustimmungen lesen (SP-1.7 a, D7): die eigenen fürs Profil, die eines Kontos und die offenen für den Admin. Admin-
// Abfragen prüfen selbst (`requireAdmin`), das Layout allein schützt die Daten nicht.

export interface ConsentRow {
  id: number
  sportpassId: string
  siteName: string
  status: ConsentStatus
  statusText: string
  consentedAt: string
  consentVersion: string
  /** nur bei aktiver Zustimmung: ob die älteren Scheiben schon nachgeladen sind (P2d, D10), sonst null */
  history: string | null
}

export interface OpenConsentRow {
  id: number
  userId: string
  /** Name, sonst E-Mail */
  userLabel: string
  sportpassId: string
  status: ConsentStatus
  consentedAt: string
}

/** die Zustimmungen eines Kontos (der Aufrufer prüft die Sitzung), in der Folge der Zustimmung */
export async function consentRows(userId: string, timeZone: string): Promise<ConsentRow[]> {
  const rows = await db.sportpassConsent.findMany({
    where: { userId },
    orderBy: [{ consentedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sportpassId: true,
      consentedAt: true,
      consentVersion: true,
      confirmedAt: true,
      rejectedAt: true,
      returnedAt: true,
      historyLoadedAt: true,
      site: { select: { name: true } },
    },
  })
  return rows.map((r) => {
    const status = consentStatus(r)
    return {
      id: r.id,
      sportpassId: r.sportpassId.toString(),
      siteName: r.site.name,
      status,
      statusText: consentStatusText(
        status,
        r.confirmedAt ? formatDateTime(r.confirmedAt, timeZone) : null
      ),
      consentedAt: formatDateTime(r.consentedAt, timeZone),
      consentVersion: r.consentVersion,
      history:
        status !== "active"
          ? null
          : r.historyLoadedAt
            ? `ältere Scheiben nachgeladen am ${formatDateTime(r.historyLoadedAt, timeZone)}`
            : "ältere Scheiben werden nachgeladen, wenn niemand schießt",
    }
  })
}

/** für den Admin: dazu die Meldungen „nicht meine“ unter der Nummer an ihrer Anlage (P2d, D8) */
export interface AdminConsentRow extends ConsentRow {
  notMine: number
}

/** dieselben für den Admin */
export async function consentsOfUser(userId: string, timeZone: string): Promise<AdminConsentRow[]> {
  await requireAdmin()
  const [rows, keys] = await Promise.all([
    consentRows(userId, timeZone),
    db.sportpassConsent.findMany({
      where: { userId },
      select: { id: true, siteId: true, sportpassId: true },
    }),
  ])
  const counts = new Map(
    await Promise.all(
      keys.map(
        async (key) =>
          [
            key.id,
            await db.tombstone.count({
              where: {
                source: { siteId: key.siteId },
                sportpassId: key.sportpassId,
                reason: NOT_MINE,
              },
            }),
          ] as const
      )
    )
  )
  return rows.map((row) => ({ ...row, notMine: counts.get(row.id) ?? 0 }))
}

/** offen: wartende und zurückgegebene (weder bestätigt noch abgelehnt), ältere zuerst */
export async function openConsents(timeZone: string): Promise<OpenConsentRow[]> {
  await requireAdmin()
  const rows = await db.sportpassConsent.findMany({
    where: { confirmedAt: null, rejectedAt: null },
    orderBy: [{ consentedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      sportpassId: true,
      consentedAt: true,
      confirmedAt: true,
      rejectedAt: true,
      returnedAt: true,
      user: { select: { name: true, email: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userLabel: r.user.name ?? r.user.email,
    sportpassId: r.sportpassId.toString(),
    status: consentStatus(r),
    consentedAt: formatDateTime(r.consentedAt, timeZone),
  }))
}
