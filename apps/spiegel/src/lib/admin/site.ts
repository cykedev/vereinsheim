import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

// Lesen für die Admin-Seite „Anlage“ (SP-1.6 b): Anlage, Epochen, Brücken mit ihrem letzten Heartbeat, Zustimmungen
// eines Kontos. Jede Funktion prüft selbst (`requireAdmin`), das Layout allein schützt die Daten nicht.

export interface BridgeRow {
  id: number
  name: string
  version: string | null
  createdAt: string
  lastSeenAt: string | null
  lastHeartbeatAt: string | null
  revoked: boolean
  status: HeartbeatV1["status"] | null
  /** Anlage minus Brücke aus dem letzten Heartbeat, in Sekunden */
  clockOffsetSeconds: number | null
  backlog: number | null
}

export interface SiteOverview {
  site: { id: number; name: string; timeZone: string } | null
  sources: { id: number; epoch: number; confirmedAt: string | null; snapshots: number }[]
  bridges: BridgeRow[]
}

const when = (date: Date | null, timeZone: string) => (date ? formatDateTime(date, timeZone) : null)

/** die Anlage (eine je Installation, ADR-029; gibt es mehrere, die erste) mit Epochen und Brücken */
export async function siteOverview(timeZone: string): Promise<SiteOverview> {
  await requireAdmin()
  const site = await db.site.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, name: true, timeZone: true },
  })
  if (!site) return { site: null, sources: [], bridges: [] }
  const [sources, bridges] = await Promise.all([
    db.source.findMany({
      where: { siteId: site.id },
      orderBy: { epoch: "asc" },
      select: { id: true, epoch: true, confirmedAt: true, _count: { select: { snapshots: true } } },
    }),
    db.bridge.findMany({
      where: { siteId: site.id },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    }),
  ])
  return {
    site,
    sources: sources.map((s) => ({
      id: s.id,
      epoch: s.epoch,
      confirmedAt: when(s.confirmedAt, timeZone),
      snapshots: s._count.snapshots,
    })),
    bridges: bridges.map((b) => {
      const heartbeat = b.heartbeat as HeartbeatV1 | null
      return {
        id: b.id,
        name: b.name,
        version: b.version,
        createdAt: when(b.createdAt, timeZone)!,
        lastSeenAt: when(b.lastSeenAt, timeZone),
        lastHeartbeatAt: when(b.lastHeartbeatAt, timeZone),
        revoked: b.revokedAt !== null,
        status: heartbeat?.status ?? null,
        clockOffsetSeconds:
          heartbeat?.sourceClockOffsetMs == null
            ? null
            : Math.round(heartbeat.sourceClockOffsetMs / 1000),
        backlog: heartbeat?.backlog ?? null,
      }
    }),
  }
}

export interface ConsentRow {
  id: number
  sportpassId: string
  siteName: string
  confirmedAt: string | null
}

/** die SportpassIDs eines Kontos mit Zustimmung (Admin) */
export async function consentsOfUser(userId: string, timeZone: string): Promise<ConsentRow[]> {
  await requireAdmin()
  return consentRows(userId, timeZone)
}

/** dieselben, für das eigene Profil: nur die des angemeldeten Kontos (der Aufrufer prüft die Sitzung) */
export async function consentRows(userId: string, timeZone: string): Promise<ConsentRow[]> {
  const rows = await db.sportpassConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, sportpassId: true, confirmedAt: true, site: { select: { name: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    sportpassId: r.sportpassId.toString(),
    siteName: r.site.name,
    confirmedAt: when(r.confirmedAt, timeZone),
  }))
}
