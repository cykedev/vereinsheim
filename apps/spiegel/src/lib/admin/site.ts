import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { formatDateOnly, formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

// Lesen für die Admin-Seite „Anlage“: Anlage, Brücken mit ihrem letzten Heartbeat (Listen: `rankings.ts`, Zustimmungen:
// `src/lib/consent/queries.ts`). Jede Funktion prüft selbst (`requireAdmin`), das Layout allein schützt die Daten nicht.

export interface BridgeRow {
  id: number
  name: string
  version: string | null
  /** nur der Tag: „verbunden am …“ */
  createdAt: string
  lastSeenAt: string | null
  lastHeartbeatAt: string | null
  revoked: boolean
  status: HeartbeatV1["status"] | null
  /** Anlage minus Brücke aus dem letzten Heartbeat, in Sekunden */
  clockOffsetSeconds: number | null
  backlog: number | null
  /** zurückgehaltene Scheiben aus dem letzten Heartbeat in Worten (SF-19, SF-20); null ohne */
  heldBack: string | null
}

export interface SiteOverview {
  /** `hasCards`: es gibt schon Scheiben; dann ist die Zeitzone fest */
  site: { id: number; name: string; timeZone: string; hasCards: boolean } | null
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
  if (!site) return { site: null, bridges: [] }
  const [cards, bridges] = await Promise.all([
    db.card.count({ where: { source: { siteId: site.id } } }),
    db.bridge.findMany({
      where: { siteId: site.id },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    }),
  ])
  return {
    site: { ...site, hasCards: cards > 0 },
    bridges: bridges.map((b) => {
      const heartbeat = b.heartbeat as HeartbeatV1 | null
      return {
        id: b.id,
        name: b.name,
        version: b.version,
        createdAt: formatDateOnly(b.createdAt, timeZone),
        lastSeenAt: when(b.lastSeenAt, timeZone),
        lastHeartbeatAt: when(b.lastHeartbeatAt, timeZone),
        revoked: b.revokedAt !== null,
        status: heartbeat?.status ?? null,
        clockOffsetSeconds:
          heartbeat?.sourceClockOffsetMs == null
            ? null
            : Math.round(heartbeat.sourceClockOffsetMs / 1000),
        backlog: heartbeat?.backlog ?? null,
        heldBack: heldBackText(heartbeat?.heldBack ?? []),
      }
    }),
  }
}

const scheiben = (n: number) => (n === 1 ? "1 Scheibe" : `${n} Scheiben`)

/**
 * Was die Brücke zurückhält, in Worten: verdeckt (Anzeigeart 5 und 10) geht nie hinaus, Anzeigeart 0 erst nach einer
 * Freigabe je Disziplin (SF-19, SF-20). Ohne zurückgehaltene Scheiben null.
 */
export function heldBackText(heldBack: HeartbeatV1["heldBack"]): string | null {
  const count = (modes: number[]) =>
    heldBack.filter((h) => modes.includes(h.displayMode)).reduce((sum, h) => sum + h.cards, 0)
  const hidden = count([5, 10])
  const unknown = heldBack.reduce((sum, h) => sum + h.cards, 0) - hidden
  const parts = [
    hidden ? `${scheiben(hidden)} mit verdeckter Wertung nicht geschickt` : "",
    unknown ? `${scheiben(unknown)} mit unbekannter Wertungsart nicht geschickt` : "",
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}
