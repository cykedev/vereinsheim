import type { PlayoffRound } from "@/generated/prisma/client"
import type { ScoringMode } from "@/generated/prisma/client"

export type PlayoffDuelOutcome = "A" | "B" | "DRAW"

export type PlayoffRuleset = {
  /** Wie viele Siege braucht man in VF/HF (z.B. 5 → 3 Siege nötig). Default: 5 */
  playoffBestOf: number | null
  /** Ob ein Viertelfinale gespielt wird (8 TN). Default: true */
  playoffHasViertelfinale: boolean | null
  /** Ob ein Achtelfinale gespielt wird (16 TN). Default: false */
  playoffHasAchtelfinale: boolean | null
  /** Hauptkriterium im Finale. Default: RINGS. */
  finalePrimary: ScoringMode
  /** Optionaler Tiebreaker 1. null = kein TB. */
  finaleTiebreaker1: ScoringMode | null
  /** Optionaler Tiebreaker 2. null = kein TB. Setzt TB1 voraus. */
  finaleTiebreaker2: ScoringMode | null
  /** Ob Sudden-Death nach Gleichstand im Finale gespielt wird. Default: true */
  finaleHasSuddenDeath: boolean | null
}

/**
 * Gibt die nächste Playoff-Runde zurück.
 * EIGHTH_FINAL → QUARTER_FINAL → SEMI_FINAL → FINAL → null
 */
export function getNextRound(round: PlayoffRound): PlayoffRound | null {
  if (round === "EIGHTH_FINAL") return "QUARTER_FINAL"
  if (round === "QUARTER_FINAL") return "SEMI_FINAL"
  if (round === "SEMI_FINAL") return "FINAL"
  return null
}

/**
 * Berechnet die nötige Siegzahl aus einer Best-of-N Konfiguration.
 * Best-of-5 → 3 Siege nötig. Best-of-3 → 2. Default: 3 (Best-of-5).
 */
export function requiredWinsFromBestOf(playoffBestOf: number | null): number {
  if (!playoffBestOf) return 3
  return Math.ceil(playoffBestOf / 2)
}

/**
 * Prüft ob ein PlayoffMatch abgeschlossen ist.
 * VF/HF: wer zuerst die nötige Siegzahl erreicht, gewinnt.
 * Finale: ein Sieg reicht (1 Duell + ggf. Sudden Death).
 */
export function isPlayoffMatchComplete(
  winsA: number,
  winsB: number,
  round: PlayoffRound,
  requiredWins = 3
): boolean {
  if (round === "FINAL") {
    return winsA >= 1 || winsB >= 1
  }
  return winsA >= requiredWins || winsB >= requiredWins
}
