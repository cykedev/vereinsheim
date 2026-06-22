import type { LeagueFormat, ScoringMode, ScoringType } from "@/generated/prisma/client"
import type { MatchupListItem } from "@/lib/matchups/types"
import { BestOfMatchupTable, ClassicLegTable, type BestOfConfig } from "./schedule-view"

interface Props {
  matchups: MatchupListItem[]
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  competitionId: string
  /** Nur ADMIN/MANAGER darf Ergebnisse eintragen */
  canManage: boolean
  /** Keine Erfassung/Korrektur mehr möglich wenn Playoffs laufen */
  playoffsStarted?: boolean
  scoringMode?: ScoringMode
  /** @deprecated Per-Teilnehmer-Typen werden aus MatchupParticipant.scoringType berechnet */
  scoringType?: ScoringType
  shotsPerSeries: number
  competitionTeilerFaktor?: number
  /** DOUBLE_ROUND_ROBIN (default) or BEST_OF_SINGLE — controls which entry UI is rendered. */
  leagueFormat?: LeagueFormat
  /** Required when leagueFormat is BEST_OF_SINGLE. */
  bestOfConfig?: BestOfConfig
}

export function ScheduleView({
  matchups,
  hinrundeDeadline,
  rueckrundeDeadline,
  canManage,
  playoffsStarted = false,
  scoringMode = "RINGTEILER",
  shotsPerSeries,
  competitionTeilerFaktor = 1,
  leagueFormat = "DOUBLE_ROUND_ROBIN",
  bestOfConfig,
}: Props) {
  if (matchups.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch kein Spielplan generiert.
      </p>
    )
  }

  const firstLeg = matchups
    .filter((m) => m.round === "FIRST_LEG")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  const secondLeg = matchups
    .filter((m) => m.round === "SECOND_LEG")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  // BEST_OF_SINGLE: one flat list of all encounters — no Spieltag grouping, no Hin-/Rückrunde.
  // Dates are agreed individually, so there are no fixed match days to group by.
  if (leagueFormat === "BEST_OF_SINGLE" && bestOfConfig) {
    // Byes ("Freilos") carry no information for the reader — omit them entirely.
    const allSorted = [...matchups]
      .filter((m) => m.awayParticipant !== null && m.status !== "BYE")
      .sort((a, b) => a.roundIndex - b.roundIndex)

    return (
      <BestOfMatchupTable
        matchups={allSorted}
        canManage={canManage && !playoffsStarted}
        scoringMode={scoringMode}
        shotsPerSeries={shotsPerSeries}
        bestOfConfig={bestOfConfig}
      />
    )
  }

  return (
    <div className="space-y-8">
      {firstLeg.length > 0 && (
        <ClassicLegTable
          title="Hinrunde"
          matchups={firstLeg}
          deadline={hinrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
          shotsPerSeries={shotsPerSeries}
          competitionTeilerFaktor={competitionTeilerFaktor}
        />
      )}
      {secondLeg.length > 0 && (
        <ClassicLegTable
          title="Rückrunde"
          matchups={secondLeg}
          deadline={rueckrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
          shotsPerSeries={shotsPerSeries}
          competitionTeilerFaktor={competitionTeilerFaktor}
        />
      )}
    </div>
  )
}
