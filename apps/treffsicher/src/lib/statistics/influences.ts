// Einflüsse: Liegt der Ø je Schuss an Tagen mit hohem Befinden oder guter Ausführung anders? Je Merkmal zwei Gruppen
// der Einheiten im Zeitraum, über und unter dem mittleren Wert (Median) des Merkmals; Einheiten genau auf ihm zählen
// zur kleineren Gruppe, bei gleich großen zu keiner. Verglichen wird wie zwei Zeiträume: Ø je Schuss über alle Schüsse
// einer Gruppe, Urteil über Schüsse und Einheiten (`compareValues`, ADR-034, ab fünf Einheiten je Seite).

import {
  compareValues,
  pooledValue,
  type CardValue,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { median } from "@vereinsheim/shot-core/stats"

/** Ø je Schuss, über die Schüsse gemittelt; auf dem Raster der Zehntel, ganze Ringe liegen darauf */
const MEAN = metricByKey("result.decimalMean") as MetricDefinition

export const INFLUENCE_KEYS = ["sleep", "energy", "stress", "motivation", "quality"] as const
export type InfluenceKey = (typeof INFLUENCE_KEYS)[number]

/** Name des Merkmals und seiner beiden Gruppen (Textbuch) */
export const INFLUENCE_LABELS: Record<InfluenceKey, { name: string; high: string; low: string }> = {
  sleep: { name: "Schlaf", high: "Guter Schlaf", low: "Schlechter Schlaf" },
  energy: { name: "Energie", high: "Viel Energie", low: "Wenig Energie" },
  stress: { name: "Stress", high: "Viel Stress", low: "Wenig Stress" },
  motivation: { name: "Motivation", high: "Hohe Motivation", low: "Niedrige Motivation" },
  quality: { name: "Ausführung", high: "Gute Ausführung", low: "Schwache Ausführung" },
}

/** eine Einheit des Zeitraums: ihr Ø je Schuss und die Werte ihrer Merkmale (fehlt eins, ist es nicht eingetragen) */
export interface InfluenceEntry {
  value: CardValue
  factors: Partial<Record<InfluenceKey, number>>
}

export interface InfluenceGroup {
  n: number
  /** Ø je Schuss als Mittel der Einheiten; null ohne Einheit */
  mean: number | null
}

export interface Influence {
  key: InfluenceKey
  /** Einheiten mit eingetragenem Wert */
  entered: number
  high: InfluenceGroup
  low: InfluenceGroup
  /** a die niedrige, b die hohe Gruppe: Δ = hoch − niedrig; null, wenn eine Gruppe leer ist */
  comparison: PeriodComparison | null
}

const group = (values: readonly CardValue[]): InfluenceGroup => ({
  n: values.length,
  mean: pooledValue(values, MEAN),
})

/**
 * die Einheiten über und unter dem Median des Merkmals. Die auf dem Median kommen zur kleineren Gruppe: Werte bleiben
 * oft auf einer Stufe stehen (Regler, Ausführung 1 bis 5), sonst fiele die Mehrheit weg. Sind beide Gruppen gleich
 * groß, zählen sie nicht, damit keine Seite bevorzugt ist
 */
export function splitAtMedian(
  entries: readonly InfluenceEntry[],
  key: InfluenceKey
): { high: CardValue[]; low: CardValue[]; entered: number } {
  const withFactor = entries.filter((e) => e.factors[key] !== undefined)
  if (!withFactor.length) return { high: [], low: [], entered: 0 }
  // nie null: es gibt mindestens einen Wert
  const middle = median(withFactor.map((e) => e.factors[key] as number)) as number
  const value = (e: InfluenceEntry) => e.factors[key] as number
  const above = withFactor.filter((e) => value(e) > middle)
  const below = withFactor.filter((e) => value(e) < middle)
  const on = withFactor.filter((e) => value(e) === middle)
  const high = above.length < below.length ? [...above, ...on] : above
  const low = below.length < above.length ? [...on, ...below] : below
  return {
    high: high.map((e) => e.value),
    low: low.map((e) => e.value),
    entered: withFactor.length,
  }
}

/** je Merkmal die beiden Gruppen und ihr Vergleich, in der Reihenfolge von `INFLUENCE_KEYS` */
export function influences(entries: readonly InfluenceEntry[]): Influence[] {
  return INFLUENCE_KEYS.map((key) => {
    const { high, low, entered } = splitAtMedian(entries, key)
    return {
      key,
      entered,
      high: group(high),
      low: group(low),
      comparison: compareValues(low, high, MEAN),
    }
  })
}

/** Ausführung einer Einheit: das Mittel der bewerteten Wertungsserien (1 bis 5); null ohne Bewertung */
export function sessionQuality(
  series: readonly {
    isPractice: boolean
    scoreTotal: number | null
    executionQuality: number | null
  }[]
): number | null {
  const rated = series.filter(
    (s) => !s.isPractice && s.scoreTotal !== null && s.executionQuality !== null
  )
  if (!rated.length) return null
  return rated.reduce((sum, s) => sum + (s.executionQuality as number), 0) / rated.length
}

/** ohne eingetragenen Wert im Zeitraum (Textbuch) */
export const NOTHING_ENTERED: Record<"wellbeing" | "quality", string> = {
  wellbeing: "Im Zeitraum hast du kein Befinden eingetragen.",
  quality: "Im Zeitraum hast du keine Serie bewertet.",
}

/** alle eingetragenen Werte gleich: keine Gruppe über oder unter der Mitte (Textbuch) */
export const ALL_SAME =
  "Deine Werte sind im Zeitraum alle gleich. So gibt es nichts zu vergleichen."

/** zu wenige Einheiten für ein Urteil (Textbuch) */
export const TOO_FEW =
  "Zu wenige Einheiten. Für ein Urteil braucht es auf jeder Seite 5. Wähle oben einen längeren Zeitraum."

/**
 * Das Urteil eines Merkmals in Alltagsworten, von der hohen Gruppe aus: „Guter Schlaf: deutlich besser“, „Kein klarer
 * Unterschied“, zu wenige Einheiten; ohne eingetragenen Wert, dass es keinen gibt. Die Worte des Urteils sind die von
 * `verdictText` (Vergleich zweier Zeiträume).
 */
export function influenceVerdict(
  influence: Influence,
  verdict: (comparison: PeriodComparison) => string
): string {
  if (!influence.entered)
    return NOTHING_ENTERED[influence.key === "quality" ? "quality" : "wellbeing"]
  if (!influence.high.n && !influence.low.n) return ALL_SAME
  const comparison = influence.comparison
  if (!comparison || comparison.test === null) return TOO_FEW
  if (comparison.verdict === "unclear") return "Kein klarer Unterschied"
  return `${INFLUENCE_LABELS[influence.key].high}: ${verdict(comparison)}`
}
