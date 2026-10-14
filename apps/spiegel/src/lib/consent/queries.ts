import { formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

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
    }
  })
}

/** dieselben für den Admin */
export async function consentsOfUser(userId: string, timeZone: string): Promise<ConsentRow[]> {
  await requireAdmin()
  return consentRows(userId, timeZone)
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
