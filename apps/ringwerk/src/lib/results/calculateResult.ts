import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { calculateRingteiler } from "@/lib/scoring/calculateScore"

export { calculateRingteiler }

/** Maximalringe pro Seite (10 Schuss) je Wertungsart */
export const MAX_RINGS: Record<ScoringType, number> = {
  WHOLE: 100,
  DECIMAL: 109,
}

export type MatchOutcome = "HOME_WIN" | "AWAY_WIN" | "DRAW"

/**
 * Bestimmt das Ergebnis eines Duells anhand des Wertungsmodus.
 *
 * RINGTEILER:    Niedrigerer Ringteiler gewinnt. Tiebreak: höhere Ringe, dann kleinerer Teiler.
 * RINGS:         Höhere Seriensumme gewinnt. Tiebreak: niedrigerer Teiler.
 * RINGS_DECIMAL: Wie RINGS.
 * TEILER:        Kleinerer Teiler gewinnt. Tiebreak: höhere Ringe.
 * Alle anderen:  Fallback auf RINGTEILER.
 */
export function determineOutcome(
  home: { rings: number; teiler: number; ringteiler: number },
  away: { rings: number; teiler: number; ringteiler: number },
  scoringMode: ScoringMode = "RINGTEILER"
): MatchOutcome {
  if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") {
    // Höhere Ringe gewinnt
    if (home.rings > away.rings) return "HOME_WIN"
    if (home.rings < away.rings) return "AWAY_WIN"
    // Tiebreak: kleinerer Teiler
    if (home.teiler < away.teiler) return "HOME_WIN"
    if (home.teiler > away.teiler) return "AWAY_WIN"
    return "DRAW"
  }

  if (scoringMode === "TEILER") {
    // Kleinerer Teiler gewinnt
    if (home.teiler < away.teiler) return "HOME_WIN"
    if (home.teiler > away.teiler) return "AWAY_WIN"
    // Tiebreak: höhere Ringe
    if (home.rings > away.rings) return "HOME_WIN"
    if (home.rings < away.rings) return "AWAY_WIN"
    return "DRAW"
  }

  // RINGTEILER (und alle anderen Modi als Fallback)
  // Niedrigerer Ringteiler gewinnt
  if (home.ringteiler < away.ringteiler) return "HOME_WIN"
  if (home.ringteiler > away.ringteiler) return "AWAY_WIN"

  // Tiebreak 1: höhere Seriensumme
  if (home.rings > away.rings) return "HOME_WIN"
  if (home.rings < away.rings) return "AWAY_WIN"

  // Tiebreak 2: kleinerer Teiler
  if (home.teiler < away.teiler) return "HOME_WIN"
  if (home.teiler > away.teiler) return "AWAY_WIN"

  return "DRAW"
}
