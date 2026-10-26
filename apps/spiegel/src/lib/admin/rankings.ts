import { formatMonthYear } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

// Lesen für die Admin-Seite „Listen“ (die `Rangliste` aus Meyton, in der Oberfläche „Liste“). Je Liste nur Zahlen über die
// ganze Anlage, die letzte Scheibe nur als Monat ([[spiegel-privacy]]). Jede Funktion prüft selbst (`requireAdmin`), das
// Layout allein schützt die Daten nicht.

/** eine Liste aus Meyton mit ihrer Art */
export interface RankingRow {
  id: number
  name: string
  /** null: nicht festgelegt, ihre Scheiben zählen so, wie Meyton sie vermerkt */
  kind: "training" | "competition" | null
  /** Scheiben in Spiegel in dieser Liste (nicht gelöscht) */
  cards: number
  /** Monat der letzten Scheibe, etwa „Oktober 2026“; null ohne Scheibe */
  lastCardMonth: string | null
}

/** die Anlage (eine je Installation, ADR-029; gibt es mehrere, die erste) */
const firstSite = () => db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })

/** die Listen einer Anlage nach Namen mit ihren Zahlen; mit `id` nur diese eine */
async function rows(siteId: number, timeZone: string, id?: number): Promise<RankingRow[]> {
  const rankings = await db.ranking.findMany({
    where: { siteId, ...(id !== undefined && { id }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  })
  if (!rankings.length) return []
  const counts = await db.card.groupBy({
    by: ["rankingId"],
    // nur Scheiben, die es in Spiegel noch gibt
    where: { rankingId: { in: rankings.map((r) => r.id) }, deletedAt: null },
    _count: true,
    _max: { startedAt: true },
  })
  return rankings.map((ranking) => {
    const count = counts.find((c) => c.rankingId === ranking.id)
    return {
      ...ranking,
      cards: count?._count ?? 0,
      lastCardMonth: count?._max.startedAt ? formatMonthYear(count._max.startedAt, timeZone) : null,
    }
  })
}

/** alle Listen der Anlage */
export async function rankingOverview(timeZone: string): Promise<RankingRow[]> {
  await requireAdmin()
  const site = await firstSite()
  return site ? rows(site.id, timeZone) : []
}

/** eine Liste der Anlage; null, wenn es sie dort nicht gibt */
export async function rankingDetail(id: number, timeZone: string): Promise<RankingRow | null> {
  await requireAdmin()
  const site = await firstSite()
  if (!site) return null
  return (await rows(site.id, timeZone, id))[0] ?? null
}
