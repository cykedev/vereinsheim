import type { ScoringMode } from "@/generated/prisma/client"
import type { PlayoffDuelOutcome } from "./playoffRuleset"

/**
 * Wendet ein einzelnes Kriterium auf die beiden Finale-Ergebnisse an.
 * Gibt "A", "B" oder "DRAW" zurück.
 */
function compareByFinale(
  criterion: ScoringMode,
  ringsA: number,
  ringsB: number,
  ringteilerA?: number,
  teilerA?: number,
  ringteilerB?: number,
  teilerB?: number
): PlayoffDuelOutcome {
  if (criterion === "RINGTEILER") {
    if (ringteilerA !== undefined && ringteilerB !== undefined) {
      if (ringteilerA < ringteilerB) return "A"
      if (ringteilerA > ringteilerB) return "B"
    }
    return "DRAW"
  }
  if (criterion === "TEILER") {
    if (teilerA !== undefined && teilerB !== undefined) {
      if (teilerA < teilerB) return "A"
      if (teilerA > teilerB) return "B"
    }
    return "DRAW"
  }
  // RINGS / RINGS_DECIMAL: höhere Ringzahl gewinnt
  if (ringsA > ringsB) return "A"
  if (ringsA < ringsB) return "B"
  return "DRAW"
}

/**
 * Bestimmt den Gewinner eines Finale-Einzelschusses.
 * Kette: finalePrimary → finaleTiebreaker1 → finaleTiebreaker2 → DRAW (Verlängerung).
 */
export function determineFinaleRoundWinner(
  ringsA: number,
  ringsB: number,
  finalePrimary?: ScoringMode | null,
  ringteilerA?: number,
  teilerA?: number,
  ringteilerB?: number,
  teilerB?: number,
  finaleTiebreaker1?: ScoringMode | null,
  finaleTiebreaker2?: ScoringMode | null
): PlayoffDuelOutcome {
  const primary = finalePrimary ?? "RINGS"
  const result1 = compareByFinale(
    primary,
    ringsA,
    ringsB,
    ringteilerA,
    teilerA,
    ringteilerB,
    teilerB
  )
  if (result1 !== "DRAW") return result1

  if (finaleTiebreaker1) {
    const result2 = compareByFinale(
      finaleTiebreaker1,
      ringsA,
      ringsB,
      ringteilerA,
      teilerA,
      ringteilerB,
      teilerB
    )
    if (result2 !== "DRAW") return result2
  }

  if (finaleTiebreaker2) {
    const result3 = compareByFinale(
      finaleTiebreaker2,
      ringsA,
      ringsB,
      ringteilerA,
      teilerA,
      ringteilerB,
      teilerB
    )
    if (result3 !== "DRAW") return result3
  }

  return "DRAW"
}

/**
 * Prüft ob das Finale-Ergebnis Teiler-Daten erfordert.
 * True wenn mindestens eines der Kriterien RINGTEILER oder TEILER ist.
 */
export function finaleNeedsTeiler(
  finalePrimary: ScoringMode,
  finaleTiebreaker1?: ScoringMode | null,
  finaleTiebreaker2?: ScoringMode | null
): boolean {
  const needsTeiler = (m: ScoringMode | null | undefined) => m === "RINGTEILER" || m === "TEILER"
  return (
    needsTeiler(finalePrimary) || needsTeiler(finaleTiebreaker1) || needsTeiler(finaleTiebreaker2)
  )
}

/**
 * Bestimmt den Gewinner eines Playoff-Duells (VF/HF).
 * Niedrigerer Ringteiler gewinnt.
 * Bei Gleichstand: 1. höhere Seriensumme, 2. kleinerer Teiler, 3. DRAW.
 */
export function determinePlayoffDuelWinner(
  ringteilerA: number,
  totalRingsA: number,
  teilerA: number,
  ringteilerB: number,
  totalRingsB: number,
  teilerB: number
): PlayoffDuelOutcome {
  if (ringteilerA < ringteilerB) return "A"
  if (ringteilerA > ringteilerB) return "B"

  if (totalRingsA > totalRingsB) return "A"
  if (totalRingsA < totalRingsB) return "B"

  if (teilerA < teilerB) return "A"
  if (teilerA > teilerB) return "B"

  return "DRAW"
}
