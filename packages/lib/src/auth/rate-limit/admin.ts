// Admin-Auswertung der Ratenbegrenzung (vorher je App kopiert): Schlüssel lesen und prüfen, Zeilen für die Oberfläche
// abbilden, aktive Sperren und die lautesten Schlüssel laden. Die Server Actions bleiben in den Apps (eine geteilte Datei
// darf keine Server Action re-exportieren); sie prüfen die Rolle und rufen diese Funktionen.

import { isIP } from "node:net"

import { MAX_USER_EMAIL_LENGTH } from "../validation"
import type { AdminLoginRateLimitBucket, AdminLoginRateLimitInsights } from "./adminTypes"
import {
  LOGIN_BUCKET_SELECT,
  type LoginRateLimitBucketDelegate,
  type LoginRateLimitBucketRow,
} from "./stores"

/** die lautesten Schlüssel der letzten so vielen Stunden */
export const TOP_NOISY_WINDOW_HOURS = 24
export const TOP_NOISY_LIMIT = 10
/** so viele aktive Sperren zeigt die Tabelle höchstens */
export const BLOCKED_LIMIT = 200
const MAX_KEY_LENGTH = 400

export const EMPTY_INSIGHTS: AdminLoginRateLimitInsights = {
  totalBucketCount: 0,
  activeBlockedCount: 0,
  activeBlockedBuckets: [],
  topNoisyBuckets: [],
}

/** „email:<normalisiert>“ oder „ip:<Adresse>“; sonst null */
export function parseLoginRateLimitKey(
  key: string
): { type: AdminLoginRateLimitBucket["type"]; identifier: string } | null {
  if (key.startsWith("email:")) {
    const identifier = key.slice("email:".length)
    return identifier && identifier.length <= MAX_USER_EMAIL_LENGTH
      ? { type: "EMAIL", identifier }
      : null
  }
  if (key.startsWith("ip:")) {
    const identifier = key.slice("ip:".length)
    return identifier && isIP(identifier) !== 0 ? { type: "IP", identifier } : null
  }
  return null
}

/** ein Schlüssel, den der Admin entsperren darf (schon getrimmt) */
export function isLoginRateLimitKey(key: string): boolean {
  return key.length >= 1 && key.length <= MAX_KEY_LENGTH && parseLoginRateLimitKey(key) !== null
}

/** eine Zeile für die Oberfläche; ein unlesbarer Schlüssel fällt weg */
export function toAdminBucket(row: LoginRateLimitBucketRow): AdminLoginRateLimitBucket | null {
  const parsed = parseLoginRateLimitKey(row.key)
  if (!parsed) return null
  return {
    key: row.key,
    type: parsed.type,
    identifier: parsed.identifier,
    attempts: row.attempts,
    windowStartedAt: row.windowStartedAt,
    blockedUntil: row.blockedUntil,
    lastAttemptAt: row.lastAttemptAt,
  }
}

const toAdminBuckets = (rows: readonly LoginRateLimitBucketRow[]) =>
  rows.flatMap((row) => toAdminBucket(row) ?? [])

/** die aktiven Sperren, die bald endende zuerst */
export async function loadBlockedLoginBuckets(
  table: LoginRateLimitBucketDelegate,
  now: Date
): Promise<AdminLoginRateLimitBucket[]> {
  const rows = await table.findMany({
    where: { blockedUntil: { gt: now } },
    select: LOGIN_BUCKET_SELECT,
    orderBy: [{ blockedUntil: "asc" }, { lastAttemptAt: "desc" }],
    take: BLOCKED_LIMIT,
  })
  return toAdminBuckets(rows)
}

/** Zahlen, aktive Sperren und die lautesten Schlüssel der letzten 24 Stunden */
export async function loadLoginRateLimitInsights(
  table: LoginRateLimitBucketDelegate,
  now: Date
): Promise<AdminLoginRateLimitInsights> {
  const noisySince = new Date(now.getTime() - TOP_NOISY_WINDOW_HOURS * 60 * 60 * 1000)
  const [totalBucketCount, activeBlockedCount, activeBlockedBuckets, noisyRows] = await Promise.all(
    [
      table.count(),
      table.count({ where: { blockedUntil: { gt: now } } }),
      loadBlockedLoginBuckets(table, now),
      table.findMany({
        where: { lastAttemptAt: { gte: noisySince } },
        select: LOGIN_BUCKET_SELECT,
        orderBy: [{ attempts: "desc" }, { lastAttemptAt: "desc" }, { key: "asc" }],
        take: TOP_NOISY_LIMIT,
      }),
    ]
  )
  return {
    totalBucketCount,
    activeBlockedCount,
    activeBlockedBuckets,
    topNoisyBuckets: toAdminBuckets(noisyRows),
  }
}
