import type { ScoringMode } from "@/generated/prisma/client"
import { determineOutcome } from "@/lib/results/calculateResult"
import type { StandingRow, StandingsMatchup } from "./standingsTypes"

/**
 * Sortiert eine Gruppe aktiver Teilnehmer unter Berücksichtigung des direkten Vergleichs.
 * Bei Punktgleichstand werden Kopf-an-Kopf-Punkte innerhalb der Gruppe berechnet.
 */
export function sortWithDirectComparison(
  rows: StandingRow[],
  matchups: StandingsMatchup[],
  withdrawnIds: Set<string>,
  scoringMode: ScoringMode = "RINGTEILER"
): StandingRow[] {
  // Gruppen mit gleicher Punktzahl bilden
  const pointGroups = new Map<number, StandingRow[]>()
  for (const row of rows) {
    const group = pointGroups.get(row.points) ?? []
    group.push(row)
    pointGroups.set(row.points, group)
  }

  const result: StandingRow[] = []
  const sortedPoints = [...pointGroups.keys()].sort((a, b) => b - a)

  for (const points of sortedPoints) {
    const group = pointGroups.get(points)!

    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Direkter Vergleich: Punkte aus Duellen nur zwischen Teilnehmern dieser Gruppe
    const groupIds = new Set(group.map((r) => r.participantId))
    const directPoints = new Map<string, number>()

    for (const row of group) {
      let dp = 0
      for (const m of matchups) {
        if (m.status !== "COMPLETED" || !m.awayParticipantId) continue
        if (withdrawnIds.has(m.homeParticipantId) || withdrawnIds.has(m.awayParticipantId)) continue
        // Nur Duelle zwischen Teilnehmern dieser Punktegruppe
        if (!groupIds.has(m.homeParticipantId) || !groupIds.has(m.awayParticipantId)) continue

        const isHome = m.homeParticipantId === row.participantId
        const isAway = m.awayParticipantId === row.participantId
        if (!isHome && !isAway) continue

        const homeResult = m.results.find((r) => r.participantId === m.homeParticipantId)
        const awayResult = m.results.find((r) => r.participantId === m.awayParticipantId)
        if (!homeResult || !awayResult) continue

        const outcome = determineOutcome(
          { rings: homeResult.rings, teiler: homeResult.teiler, ringteiler: homeResult.ringteiler },
          { rings: awayResult.rings, teiler: awayResult.teiler, ringteiler: awayResult.ringteiler },
          scoringMode
        )
        if (outcome === "DRAW") {
          dp += 1
        } else if ((isHome && outcome === "HOME_WIN") || (isAway && outcome === "AWAY_WIN")) {
          dp += 2
        }
      }
      directPoints.set(row.participantId, dp)
    }

    group.sort((a, b) => {
      const dpDiff =
        (directPoints.get(b.participantId) ?? 0) - (directPoints.get(a.participantId) ?? 0)
      if (dpDiff !== 0) return dpDiff

      if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") {
        // Höhere Ringe gewinnen (absteigend)
        const ringsA = a.bestRings ?? -Infinity
        const ringsB = b.bestRings ?? -Infinity
        if (ringsA !== ringsB) return ringsB - ringsA
      } else {
        // Niedrigerer Ringteiler gewinnt (aufsteigend)
        const rtA = a.bestRingteiler ?? Infinity
        const rtB = b.bestRingteiler ?? Infinity
        if (rtA !== rtB) return rtA - rtB
      }

      return a.lastName.localeCompare(b.lastName, "de")
    })

    result.push(...group)
  }

  return result
}
