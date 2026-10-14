import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

// Lesen für die Admin-Seite „Anlage“ (SP-1.6 b, P2c): Anlage, Brücken mit ihrem letzten Heartbeat, Ranglisten
// (Zustimmungen: `src/lib/consent/queries.ts`). Jede Funktion prüft selbst (`requireAdmin`), das Layout allein
// schützt die Daten nicht.

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
  /** zurückgehaltene Scheiben aus dem letzten Heartbeat in Worten (SF-19, SF-20); null ohne */
  heldBack: string | null
}

/** eine Rangliste der Anlage mit der Art, die der Admin ihr gibt; null: nicht zugeordnet (dann gilt Training) */
export interface RankingRow {
  id: number
  name: string
  kind: "training" | "competition" | null
  cards: number
}

export interface SiteOverview {
  /** `hasCards`: es gibt schon Scheiben; dann ist die Zeitzone fest (Review P2c) */
  site: { id: number; name: string; timeZone: string; hasCards: boolean } | null
  bridges: BridgeRow[]
  rankings: RankingRow[]
}

const when = (date: Date | null, timeZone: string) => (date ? formatDateTime(date, timeZone) : null)

/** die Anlage (eine je Installation, ADR-029; gibt es mehrere, die erste) mit Epochen und Brücken */
export async function siteOverview(timeZone: string): Promise<SiteOverview> {
  await requireAdmin()
  const site = await db.site.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, name: true, timeZone: true },
  })
  if (!site) return { site: null, bridges: [], rankings: [] }
  const [cards, bridges, rankings] = await Promise.all([
    db.card.count({ where: { source: { siteId: site.id } } }),
    db.bridge.findMany({
      where: { siteId: site.id },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    }),
    db.ranking.findMany({
      where: { siteId: site.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        // nur Scheiben, die es in Spiegel noch gibt (Review)
        _count: { select: { cards: { where: { deletedAt: null } } } },
      },
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
        heldBack: heldBackText(heartbeat?.heldBack ?? []),
      }
    }),
    rankings: rankings.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      cards: r._count.cards,
    })),
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
