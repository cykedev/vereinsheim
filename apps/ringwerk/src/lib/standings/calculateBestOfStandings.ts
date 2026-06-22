import {
  bestOfDuelTally,
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
  type DuelOutcome,
} from "@/lib/scoring/bestOf"
import type {
  BestOfStandingsParticipant,
  BestOfStandingsMatchup,
  BestOfStandingsConfig,
  BestOfStandingRow,
  ParticipantStats,
} from "./bestOfStandingsTypes"
import { groupByDuelNumber, sortedDuelNumbers, toDuelSeries } from "./bestOfStandingsHelpers"
import { sortStandings } from "./bestOfStandingsSort"

// Typen werden re-exportiert, damit der Import-Pfad "./calculateBestOfStandings" stabil bleibt.
export type {
  BestOfStandingsParticipant,
  BestOfStandingsSeries,
  BestOfStandingsMatchup,
  BestOfStandingsConfig,
  BestOfStandingRow,
} from "./bestOfStandingsTypes"

export function calculateBestOfStandings(
  participants: BestOfStandingsParticipant[],
  matchups: BestOfStandingsMatchup[],
  config: BestOfStandingsConfig
): BestOfStandingRow[] {
  const withdrawnIds = new Set(participants.filter((p) => p.withdrawn).map((p) => p.id))

  // Initialise stats for every participant.
  const statsMap = new Map<string, ParticipantStats>()
  for (const p of participants) {
    statsMap.set(p.id, {
      wins: 0,
      losses: 0,
      played: 0,
      duelsWon: 0,
      duelsLost: 0,
      ringteilers: [],
      ringsValues: [],
    })
  }

  for (const matchup of matchups) {
    // Skip BYEs.
    if (matchup.awayParticipantId === null) continue

    const { homeParticipantId: homeId, awayParticipantId: awayId } = matchup

    // Skip matchups involving withdrawn participants.
    if (withdrawnIds.has(homeId) || withdrawnIds.has(awayId)) continue

    // Separate regular from tiebreak series.
    const regularSeries = matchup.series.filter((s) => !s.isTiebreak)
    const tiebreakSeries = matchup.series.filter((s) => s.isTiebreak)

    // Group regular series by duelNumber → compute outcomes using full duelOutcome.
    const regularByDuel = groupByDuelNumber(regularSeries, homeId, awayId)
    const regularOutcomes: DuelOutcome[] = sortedDuelNumbers(regularByDuel).map((dn) => {
      const { home, away } = regularByDuel.get(dn)!
      return duelOutcome(
        toDuelSeries(home, config.competitionDisciplineId),
        toDuelSeries(away, config.competitionDisciplineId),
        config.scoringMode,
        config.tiebreaker1,
        config.tiebreaker2
      )
    })

    // Group tiebreak (Stechschuss) series by duelNumber → decided purely by shot value (rings).
    const tiebreakByDuel = groupByDuelNumber(tiebreakSeries, homeId, awayId)
    const tiebreakOutcomes: DuelOutcome[] = sortedDuelNumbers(tiebreakByDuel).map((dn) => {
      const { home, away } = tiebreakByDuel.get(dn)!
      return stechschussOutcome(home.rings, away.rings)
    })

    // Resolve the match.
    const status = resolveBestOf(regularOutcomes, tiebreakOutcomes, {
      bestOf: config.bestOf,
      playAll: config.playAll,
    })

    // Only count completed matches.
    if (status.kind !== "complete") continue

    const homeStats = statsMap.get(homeId)!
    const awayStats = statsMap.get(awayId)!

    homeStats.played++
    awayStats.played++

    if (status.winner === "A") {
      homeStats.wins++
      awayStats.losses++
    } else {
      awayStats.wins++
      homeStats.losses++
    }

    // Tally duel wins. A Stechschuss-decided tie counts for the Stechschuss winner.
    const tally = bestOfDuelTally(regularOutcomes, status)
    homeStats.duelsWon += tally.homeWins
    homeStats.duelsLost += tally.awayWins
    awayStats.duelsWon += tally.awayWins
    awayStats.duelsLost += tally.homeWins

    // Collect best-result data from each participant's regular series.
    for (const s of regularSeries) {
      const stats = statsMap.get(s.participantId)
      if (!stats) continue
      stats.ringteilers.push(s.ringteiler)
      stats.ringsValues.push(s.rings)
    }
  }

  // Build rows.
  const rows: BestOfStandingRow[] = participants.map((p) => {
    const s = statsMap.get(p.id)!
    const bestRingteiler = s.ringteilers.length > 0 ? Math.min(...s.ringteilers) : null
    const bestRings = s.ringsValues.length > 0 ? Math.max(...s.ringsValues) : null
    return {
      participantId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      withdrawn: p.withdrawn,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      duelsWon: s.duelsWon,
      duelsLost: s.duelsLost,
      duelDiff: s.duelsWon - s.duelsLost,
      bestRingteiler,
      bestRings,
      rank: 0,
    }
  })

  const active = rows.filter((r) => !r.withdrawn)
  const withdrawn = rows.filter((r) => r.withdrawn)

  const sorted = sortStandings(active, config.scoringMode)

  sorted.forEach((r, i) => {
    r.rank = i + 1
  })
  withdrawn.forEach((r) => {
    r.rank = sorted.length + 1
  })

  return [...sorted, ...withdrawn]
}
