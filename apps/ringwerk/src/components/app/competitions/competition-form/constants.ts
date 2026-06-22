import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

// DECIMAL_REST benötigt Einzelschüsse — nur für Liga verfügbar
export const EVENT_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) => k !== "DECIMAL_REST")
)

// Saison: nur Wertungen die auf Serien-Basis sinnvoll sind
export const SEASON_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) =>
    ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"].includes(k)
  )
)

// BEST_OF_SINGLE group phase: only modes where a head-to-head duel yields a clear numeric result
export const BEST_OF_SINGLE_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) =>
    ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"].includes(k)
  )
)

export const TARGET_VALUE_TYPE_LABELS: Record<string, string> = {
  RINGS: "Ringe (ganzzahlig)",
  RINGS_DECIMAL: "Ringe (Zehntelwertung)",
  TEILER: "Teiler (korrigiert)",
}

export const BEST_OF_DUEL_MODES = ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"]

export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().slice(0, 10)
}
