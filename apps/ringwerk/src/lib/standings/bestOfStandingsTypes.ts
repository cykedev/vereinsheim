import type { ScoringMode } from "@/generated/prisma/client"

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BestOfStandingsParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
}

export interface BestOfStandingsSeries {
  participantId: string
  duelNumber: number
  isTiebreak: boolean
  rings: number
  teiler: number
  /** stored (already effective-factor-corrected at save time). */
  ringteiler: number
  /** the discipline's configured factor. */
  teilerFaktor: number
}

export interface BestOfStandingsMatchup {
  homeParticipantId: string
  awayParticipantId: string | null // null = BYE
  series: BestOfStandingsSeries[]
}

export interface BestOfStandingsConfig {
  scoringMode: ScoringMode
  bestOf: number
  playAll: boolean
  tiebreaker1: ScoringMode | null
  tiebreaker2: ScoringMode | null
  /** Competition.disciplineId — null = mixed (factor active), else fixed (factor 1). */
  competitionDisciplineId: string | null
}

// ---------------------------------------------------------------------------
// Direct comparison (head-to-head, Kriterium 4)
// ---------------------------------------------------------------------------

/** Direktes Begegnungsergebnis aus Sicht eines Teilnehmers (calculate → sort). */
export interface DirectResult {
  /** eigene Satzsiege in der direkten Begegnung */
  duelsWon: number
  /** Satzsiege des Gegners */
  duelsLost: number
  /** hat dieser Teilnehmer die Begegnung gewonnen */
  won: boolean
}

/** Kopf-an-Kopf-Ergebnisse: Teilnehmer → Gegner → Ergebnis (nur abgeschlossene Begegnungen). */
export type HeadToHead = Map<string, Map<string, DirectResult>>

/**
 * Erklärt die Platzierung einer Zeile bei Punktgleichstand (Kriterium 4 = direkter Vergleich),
 * damit die Tabelle nachvollziehbar bleibt:
 * - `decided`: 2er-Gleichstand, direkte Begegnung gefallen → Satz aus eigener Sicht + Gegner
 * - `record`:  3er+-Gleichstand, Mini-Liga-Bilanz innerhalb der Gruppe entscheidet
 * - `open`:    direkte Begegnung (noch) nicht gespielt → alphabetisch gereiht
 * - `even`:    gespielt, aber gleich/zyklisch → alphabetisch gereiht
 */
export type DirectComparison =
  | { kind: "decided"; result: "win" | "loss"; satz: [number, number]; opponent: string }
  | { kind: "record"; wins: number; losses: number }
  | { kind: "open"; opponent: string | null }
  | { kind: "even" }

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface BestOfStandingRow {
  participantId: string
  firstName: string
  lastName: string
  withdrawn: boolean
  played: number
  wins: number
  losses: number
  duelsWon: number
  duelsLost: number
  duelDiff: number
  /**
   * Bestes Einzelergebnis. Seit 2026-06-24 KEIN Sortier-/Anzeige-Kriterium mehr — der direkte
   * Vergleich (siehe `directComparison`) ersetzt den Wert als Kriterium 4. Wird weiter berechnet,
   * damit ein etwaiger Revert nur eine Stelle berührt (vgl. graph-captured
   * "best-of-standings-direct-comparison-tiebreak").
   */
  bestRingteiler: number | null
  bestRings: number | null
  /**
   * Begründung der Platzierung bei Punktgleichstand (Kriterium 4).
   * `null` = Zeile ist NICHT in einem umkämpften Gleichstand → Anzeige "—".
   */
  directComparison: DirectComparison | null
  rank: number
}

// ---------------------------------------------------------------------------
// Internal stat accumulator
// ---------------------------------------------------------------------------

export interface ParticipantStats {
  wins: number
  losses: number
  played: number
  duelsWon: number
  duelsLost: number
  ringteilers: number[]
  ringsValues: number[]
}
