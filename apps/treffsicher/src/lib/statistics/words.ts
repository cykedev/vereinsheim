import type { PeriodSection } from "@vereinsheim/shot-ui/layout/sections"
import type { PeriodWords } from "@vereinsheim/shot-ui/period/words"

// Wörter der Statistik: Die Bausteine aus Spiegel sagen „Scheibe“, Treffsicher sagt „Einheit“ (Textbuch).

export const SESSION_WORDS: PeriodWords = {
  one: "Einheit",
  many: "Einheiten",
  noRecords: "Noch kein Rekord. Es zählen nur Einheiten mit Einzelschüssen in jeder Serie.",
}

/** Abschnitte der Statistik in Seitenreihenfolge, mit den Ankern der Seite eines Zeitraums */
export const STATISTICS_SECTIONS: readonly { id: PeriodSection; label: string }[] = [
  { id: "history", label: "Verlauf" },
  { id: "cards", label: "Einheiten" },
  { id: "numbers", label: "Zahlen" },
  { id: "analysis", label: "Analyse" },
]
