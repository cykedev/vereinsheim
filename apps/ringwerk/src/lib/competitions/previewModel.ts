import type { CompetitionListItem } from "@/lib/competitions/types"
import type { PlayoffBracketData } from "@/lib/playoffs/types"
import type { BestOfStandingRow, StandingRow } from "@/lib/standings/queries"
import type { EventRankedEntry, EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import type {
  ResolvedSeasonSort,
  SortedSeasonStandingsEntry,
} from "@/lib/scoring/sortSeasonStandings"

/** Vorschau-Länge der Tabellen in Karten; der Rest steht auf der Detailseite. */
export const PREVIEW_ROWS = 6

/**
 * Was eine Wettbewerbskarte (Dashboard und Wettbewerbsliste) als Vorschau zeigt — je Typ die
 * fertig sortierte Tabelle bzw. das Bracket, plus die Seite, auf die die Karte verlinkt.
 */
export type CompetitionPreview =
  | {
      kind: "league"
      competition: CompetitionListItem
      href: string
      isBestOf: boolean
      playoffsStarted: boolean
      standings: StandingRow[]
      bestOfStandings: BestOfStandingRow[]
      bracket: PlayoffBracketData
    }
  | {
      kind: "event"
      competition: CompetitionListItem
      href: string
      isTeamEvent: boolean
      ranked: EventRankedEntry[]
      teamRanked: EventTeamRankedEntry[]
    }
  | {
      kind: "season"
      competition: CompetitionListItem
      href: string
      standings: SortedSeasonStandingsEntry[]
      minSeries: number | null
      sort: ResolvedSeasonSort
    }

function previewRowCount(p: CompetitionPreview): number {
  if (p.kind === "league") return p.isBestOf ? p.bestOfStandings.length : p.standings.length
  if (p.kind === "event") return p.isTeamEvent ? p.teamRanked.length : p.ranked.length
  return p.standings.length
}

/** Zeilen, die die Vorschau nicht zeigt; undefined, wenn statt einer Tabelle das Bracket steht. */
export function previewMoreCount(p: CompetitionPreview): number | undefined {
  if (p.kind === "league" && p.playoffsStarted) return undefined
  return Math.max(0, previewRowCount(p) - PREVIEW_ROWS)
}

export function previewIsEmpty(p: CompetitionPreview): boolean {
  if (p.kind === "league" && p.playoffsStarted) return false
  return previewRowCount(p) === 0
}

export function previewEmptyText(p: CompetitionPreview): string {
  return p.kind === "season" ? "Noch keine Serien erfasst" : "Noch keine Ergebnisse erfasst"
}
