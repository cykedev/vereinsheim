import type { ScoringMode } from "@/generated/prisma/client"
import { determineOutcome } from "@/lib/results/calculateResult"
import type {
  StandingsParticipant,
  StandingsMatchup,
  StandingRow,
  ParticipantStats,
} from "./standingsTypes"
import { sortWithDirectComparison } from "./standingsSort"

// Typen werden re-exportiert, damit der Import-Pfad "./calculateStandings" stabil bleibt.
export type {
  StandingsParticipant,
  StandingsMatchupResult,
  StandingsMatchup,
  StandingRow,
} from "./standingsTypes"

/**
 * Berechnet die Ligatabelle aus Teilnehmern und Paarungen.
 * Sortierreihenfolge:
 *   1. Zurückgezogene Teilnehmer immer ans Ende
 *   2. Punkte absteigend (Sieg=2, Unentschieden=1, Freilos=2)
 *   3. Direkter Vergleich (Punkte aus Kopf-an-Kopf-Duellen der Gruppe)
 *   4. Bester Ringteiler (niedrigster Wert) aufsteigend
 *   5. Nachname alphabetisch (Stabilisierung)
 *
 * Matchups mit mindestens einem zurückgezogenen Teilnehmer werden nicht gewertet.
 */
export function calculateStandings(
  participants: StandingsParticipant[],
  matchups: StandingsMatchup[],
  scoringMode: ScoringMode = "RINGTEILER"
): StandingRow[] {
  const withdrawnIds = new Set(participants.filter((p) => p.withdrawn).map((p) => p.id))

  const statsMap = new Map<string, ParticipantStats>()
  for (const p of participants) {
    statsMap.set(p.id, {
      wins: 0,
      draws: 0,
      losses: 0,
      byes: 0,
      played: 0,
      ringteilers: [],
      ringsValues: [],
    })
  }

  for (const matchup of matchups) {
    const homeWithdrawn = withdrawnIds.has(matchup.homeParticipantId)
    const awayWithdrawn = matchup.awayParticipantId
      ? withdrawnIds.has(matchup.awayParticipantId)
      : false

    if (matchup.status === "BYE") {
      // Freilos zählt nur wenn Teilnehmer nicht zurückgezogen
      if (!homeWithdrawn) {
        statsMap.get(matchup.homeParticipantId)!.byes++
      }
      continue
    }

    if (matchup.status !== "COMPLETED") continue
    // Paarungen mit zurückgezogenem Teilnehmer werden nicht gewertet
    if (homeWithdrawn || awayWithdrawn) continue

    const homeResult = matchup.results.find((r) => r.participantId === matchup.homeParticipantId)
    const awayResult = matchup.results.find((r) => r.participantId === matchup.awayParticipantId)
    if (!homeResult || !awayResult) continue

    const outcome = determineOutcome(
      { rings: homeResult.rings, teiler: homeResult.teiler, ringteiler: homeResult.ringteiler },
      { rings: awayResult.rings, teiler: awayResult.teiler, ringteiler: awayResult.ringteiler },
      scoringMode
    )

    const homeStats = statsMap.get(matchup.homeParticipantId)!
    const awayStats = statsMap.get(matchup.awayParticipantId!)!

    homeStats.played++
    awayStats.played++
    homeStats.ringteilers.push(homeResult.ringteiler)
    awayStats.ringteilers.push(awayResult.ringteiler)
    homeStats.ringsValues.push(homeResult.rings)
    awayStats.ringsValues.push(awayResult.rings)

    if (outcome === "HOME_WIN") {
      homeStats.wins++
      awayStats.losses++
    } else if (outcome === "AWAY_WIN") {
      awayStats.wins++
      homeStats.losses++
    } else {
      homeStats.draws++
      awayStats.draws++
    }
  }

  const rows: StandingRow[] = participants.map((p) => {
    const s = statsMap.get(p.id)!
    const points = s.wins * 2 + s.draws + s.byes * 2
    const bestRingteiler = s.ringteilers.length > 0 ? Math.min(...s.ringteilers) : null
    const bestRings = s.ringsValues.length > 0 ? Math.max(...s.ringsValues) : null
    return {
      participantId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      withdrawn: p.withdrawn,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      byes: s.byes,
      points,
      bestRingteiler,
      bestRings,
      rank: 0,
    }
  })

  const active = rows.filter((r) => !r.withdrawn)
  const withdrawn = rows.filter((r) => r.withdrawn)

  const sorted = sortWithDirectComparison(active, matchups, withdrawnIds, scoringMode)

  sorted.forEach((r, i) => {
    r.rank = i + 1
  })
  withdrawn.forEach((r) => {
    r.rank = sorted.length + 1
  })

  return [...sorted, ...withdrawn]
}
