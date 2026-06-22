import type { ScoringMode, ScoringType, TargetValueType } from "@/generated/prisma/client"

/**
 * Bestimmt den effektiven ScoringType für die Eingabe/Anzeige von Ringen.
 *
 * RINGS          → immer WHOLE (explizit ganzzahlig)
 * RINGS_DECIMAL  → immer DECIMAL
 * DECIMAL_REST   → immer DECIMAL (Nachkommastellen werden summiert)
 * TARGET_*       → richtet sich nach targetValueType:
 *                    RINGS         → WHOLE
 *                    RINGS_DECIMAL → DECIMAL
 *                    TEILER / null → folgt der Disziplin
 * RINGTEILER, TEILER → folgt der Disziplin; WHOLE als Fallback bei gemischten Wettbewerben
 */
export function getEffectiveScoringType(
  scoringMode: ScoringMode,
  discipline: { scoringType: ScoringType } | null,
  targetValueType?: TargetValueType | null
): ScoringType {
  if (scoringMode === "RINGS") return "WHOLE"
  if (scoringMode === "RINGS_DECIMAL" || scoringMode === "DECIMAL_REST") return "DECIMAL"
  if (
    scoringMode === "TARGET_ABSOLUTE" ||
    scoringMode === "TARGET_UNDER" ||
    scoringMode === "TARGET_OVER"
  ) {
    if (targetValueType === "RINGS_DECIMAL") return "DECIMAL"
    if (targetValueType === "RINGS") return "WHOLE"
    // TEILER oder null → fall through zur Disziplin
  }
  return discipline?.scoringType ?? "WHOLE"
}

/**
 * Maximale Ringe für eine Serie in Abhängigkeit von ScoringType und Schusszahl.
 * WHOLE:   shotsPerSeries × 10
 * DECIMAL: shotsPerSeries × 10.9
 */
export function getMaxRings(scoringType: ScoringType, shotsPerSeries: number): number {
  if (scoringType === "DECIMAL") return shotsPerSeries * 10.9
  return shotsPerSeries * 10
}

/**
 * Formatiert einen Ringe-Wert für die Anzeige in Tabellen und PDFs.
 * WHOLE:   ganzzahlig, kein Dezimalzeichen  ("96")
 * DECIMAL: deutsches Komma, 1 Stelle        ("96,5" | "109,0")
 */
export function formatRings(value: number | null, scoringType: ScoringType): string {
  if (value === null) return "–"
  if (scoringType === "DECIMAL") return value.toFixed(1).replace(".", ",")
  return String(Math.round(value))
}

/**
 * Formatiert Teiler- und Ringteiler-Werte für die Anzeige.
 * Immer: deutsches Komma, 1 Nachkommastelle ("3,7" | "12,0")
 */
export function formatDecimal1(value: number | null): string {
  if (value === null) return "–"
  return value.toFixed(1).replace(".", ",")
}

/**
 * Liefert die HTML-Input-Props für das RingsInput-Feld.
 * Wird von RingsInput.tsx intern genutzt.
 */
export function getRingsInputProps(
  scoringType: ScoringType,
  shotsPerSeries: number
): {
  inputMode: "numeric" | "decimal"
  placeholder: string
  step: string
  min: number
  max: number
} {
  const max = getMaxRings(scoringType, shotsPerSeries)
  if (scoringType === "DECIMAL") {
    return { inputMode: "decimal", placeholder: "z.B. 96,5", step: "0.1", min: 0, max }
  }
  return { inputMode: "numeric", placeholder: "z.B. 96", step: "1", min: 0, max }
}
