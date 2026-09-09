import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

// DECIMAL_REST benötigt Einzelschüsse — nur für Liga verfügbar
export const EVENT_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) => k !== "DECIMAL_REST")
)

// Nur Wertungen, die auf Serien-Basis sinnvoll sind — genutzt für Liga/Saison und die
// Playoff-Kriterien.
export const SERIES_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) =>
    ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"].includes(k)
  )
)

// Saison-Auswahl „Wertungsmodus": die Serien-Modi plus die zwei alternierenden Sortierungen.
// Die alternierenden Einträge sind keine ScoringMode-Werte, sondern setzen Competition.
// seasonSortMode (siehe useCompetitionFormState.setSeasonWertung).
export const SEASON_SORT_MODES = ["ALT_RINGS_FIRST", "ALT_TEILER_FIRST"] as const

export const SEASON_WERTUNG_LABELS: Record<string, string> = {
  ...SERIES_SCORING_MODE_LABELS,
  ALT_RINGS_FIRST: "Ringe/Teiler alternierend",
  ALT_TEILER_FIRST: "Teiler/Ringe alternierend",
}

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
