import type { ScoringMode } from "@/generated/prisma/client"

export type { ScoringMode }

/** Sortierrichtung: "asc" = niedrigerer Wert gewinnt, "desc" = höherer Wert gewinnt */
export type ScoreDirection = "asc" | "desc"

/** Sortierrichtung pro Wertungsmodus */
export const SCORE_DIRECTION: Record<ScoringMode, ScoreDirection> = {
  RINGTEILER: "asc",
  RINGS: "desc",
  RINGS_DECIMAL: "desc",
  TEILER: "asc",
  DECIMAL_REST: "desc",
  TARGET_ABSOLUTE: "asc",
  TARGET_UNDER: "asc",
  TARGET_OVER: "asc",
}

/** Eingabewerte für die universelle Score-Berechnung */
export interface ScoreInput {
  rings: number
  teiler: number
  /** Disziplin-Korrekturfaktor (Discipline.teilerFaktor) */
  faktor: number
  /** Maximalringe pro Serie: 100 (WHOLE) oder 109 (DECIMAL) */
  maxRings: number
  /** Für DECIMAL_REST: Einzelschüsse als Dezimalzahlen */
  shots?: number[]
  /** Für TARGET_*: Zielwert */
  targetValue?: number
  /** Für TARGET_*: vorab berechneter Messwert (z.B. correctedTeiler oder rings) */
  measuredValue?: number
}

/** Eintrag für die Rangliste (Eingabe) */
export interface RankableEntry {
  participantId: string
  score: number
}

/** Eintrag in der Rangliste (Ausgabe) */
export interface RankedEntry extends RankableEntry {
  rank: number
}
