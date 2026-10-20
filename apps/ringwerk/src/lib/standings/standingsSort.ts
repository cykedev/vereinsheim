import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { formatDecimal1, formatRings } from "@/lib/series/scoring-format"
import { determineOutcome } from "@/lib/results/calculateResult"
import { assignSharedRanks } from "@/lib/scoring/sharedRanks"
import { duelSide, type StandingRow, type StandingsMatchup } from "./standingsTypes"
import { involvesWithdrawn } from "./withdrawn"

/**
 * Eine Zeile mit mindestens einem Ergebnis (Duell oder Freilos) — nur sie trägt Podiumsfarben.
 * Tabelle und PDF nutzen dieses eine Prädikat.
 */
export function hasLeagueResult(row: Pick<StandingRow, "played" | "byes">): boolean {
  return row.played + row.byes > 0
}

/** Die Spalte der Tabelle, die nach Punkten und direktem Vergleich trennt (Bildschirm und PDF) */
export interface LeagueTieColumn {
  label: "Best. RT" | "Best. Ringe"
  value: (row: Pick<StandingRow, "bestRingteiler" | "bestRings">) => number | null
  format: (value: number | null, scoringType: ScoringType) => string
  /** Thema des „?“ am Spaltenkopf; die meisten Ringe erklärt die Hilfe zur Tabelle */
  help: "ringteiler" | null
}

/** Bei Wertung nach Ringen trennen die meisten Ringe, sonst der beste Ringteiler */
export function leagueTieColumn(scoringMode: ScoringMode): LeagueTieColumn {
  if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") {
    return {
      label: "Best. Ringe",
      value: (row) => row.bestRings,
      format: (value, scoringType) => formatRings(value, scoringType),
      help: null,
    }
  }
  return {
    label: "Best. RT",
    value: (row) => row.bestRingteiler,
    format: (value) => formatDecimal1(value),
    help: "ringteiler",
  }
}

/**
 * Sortiert die aktiven Teilnehmer unter Berücksichtigung des direkten Vergleichs und vergibt die
 * Plätze. Bei Punktgleichstand werden Kopf-an-Kopf-Punkte innerhalb der Gruppe berechnet.
 * Zeilen, die in Punkten, Direktpunkten und Bestwert gleich sind (nur der Name trennt sie),
 * teilen sich den Platz.
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

  const isRingsMode = scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL"
  // Der Bestwert, nach dem innerhalb einer Gruppe sortiert wird — spiegelt den Sortierzweig unten.
  const tieValue = leagueTieColumn(scoringMode).value

  const result: StandingRow[] = []
  // Direktpunkte über alle Gruppen; Einzelgruppen bleiben bei 0 (dort trennen schon die Punkte).
  const directPoints = new Map<string, number>()
  const sortedPoints = [...pointGroups.keys()].sort((a, b) => b - a)

  for (const points of sortedPoints) {
    const group = pointGroups.get(points)!

    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Direkter Vergleich: Punkte aus Duellen nur zwischen Teilnehmern dieser Gruppe
    const groupIds = new Set(group.map((r) => r.participantId))

    for (const row of group) {
      let dp = 0
      for (const m of matchups) {
        if (m.status !== "COMPLETED" || !m.awayParticipantId) continue
        if (involvesWithdrawn(m, withdrawnIds)) continue
        // Nur Duelle zwischen Teilnehmern dieser Punktegruppe
        if (!groupIds.has(m.homeParticipantId) || !groupIds.has(m.awayParticipantId)) continue

        const isHome = m.homeParticipantId === row.participantId
        const isAway = m.awayParticipantId === row.participantId
        if (!isHome && !isAway) continue

        const homeResult = m.results.find((r) => r.participantId === m.homeParticipantId)
        const awayResult = m.results.find((r) => r.participantId === m.awayParticipantId)
        if (!homeResult || !awayResult) continue

        const outcome = determineOutcome(duelSide(homeResult), duelSide(awayResult), scoringMode)
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

      if (isRingsMode) {
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

      return (
        a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de")
      )
    })

    result.push(...group)
  }

  const ranks = assignSharedRanks(
    result,
    (a, b) =>
      a.points === b.points &&
      (directPoints.get(a.participantId) ?? 0) === (directPoints.get(b.participantId) ?? 0) &&
      tieValue(a) === tieValue(b)
  )
  result.forEach((r, i) => {
    r.rank = ranks[i]
  })

  return result
}
