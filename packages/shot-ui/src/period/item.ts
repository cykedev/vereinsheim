// Eingabe der Seite eines Zeitraums: ein schlanker Eintrag je Scheibe oder Einheit, ohne Schüsse. Spiegel bildet
// ihn aus der Projektion (`fromProjection`), Treffsicher aus einer Einheit. Hier wird nur ausgewählt und gezählt;
// die Werte und die Bausteine der Rekorde rechnet der Fachkern (`@vereinsheim/shot-core`).

import {
  combineRecords,
  type CardValue,
  type PeriodCard,
  type PeriodRecords,
  type RecordCandidates,
  type VolumeBucket,
} from "@vereinsheim/shot-core/analysis"
import { inScoring, type MetricDefinition, type Scoring } from "@vereinsheim/shot-core/metrics"
import { recordsInView, type CardDetail } from "@vereinsheim/shot-core/projection"

import type { CardProvenance } from "../detail"

export interface PeriodItem {
  id: string
  startedAtMs: number
  kind: PeriodCard["kind"]
  /** nur Probe mit mindestens einem Schuss: zählt nur mit `includeProbeOnly` */
  probeOnly: boolean
  /** Schüsse wie am Ausdruck (Umfang, Ablesung) */
  shots: number
  /**
   * Werte der Kennzahlen der Ebene Scheibe nach Schlüssel in der Wertung (`inScoring(…).key`), mit n; ohne Wert fehlt
   * der Schlüssel oder steht null
   */
  metrics: Readonly<Record<string, { value: number; n: number; sd?: number | null } | null>>
  /** Bausteine der Rekorde je Wertung (`cardRecordCandidates`); null, wenn der Eintrag für Rekorde nicht zählt */
  records: Readonly<Record<Scoring, RecordCandidates | null>>
  /** Merkmale; für Rekorde zählt `FLAG_COUNTED_AS_MATCH` */
  flags: readonly string[]
  /** Grundlage der Werte; fehlt in Treffsicher, dann nennt die Seite keine */
  detail?: CardDetail
  /** woher die Scheibe kommt; nur ohne `measured` */
  provenance?: CardProvenance
}

/** zeitliche Folge, bei gleichem Beginn nach Id (wie im Fachkern); eine Regel für Zeitraum und Liste */
export const byStart = (
  a: { id: string; startedAtMs: number },
  b: { id: string; startedAtMs: number }
) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const inOrder = (items: readonly PeriodItem[]) => [...items].sort(byStart)

/** wie `cardValues`, aus den Einträgen: ohne Wert kein Punkt, nur Probe nur mit dem Schalter */
export function itemValues(
  items: readonly PeriodItem[],
  metric: Readonly<MetricDefinition>,
  scoring: Scoring,
  options: { includeProbeOnly?: boolean } = {}
): CardValue[] {
  if (!metric.scopes.includes("card"))
    throw new RangeError(`${metric.key}: keine Kennzahl der Ebene Scheibe`)
  const key = inScoring(metric, scoring).key
  return inOrder(items).flatMap((item) => {
    if (item.probeOnly && !options.includeProbeOnly) return []
    const entry = item.metrics[key]
    if (!entry) return []
    const value: CardValue = { id: item.id, atMs: item.startedAtMs, value: entry.value, n: entry.n }
    if (entry.sd !== undefined) value.sd = entry.sd
    return [value]
  })
}

/** wie `periodRecords`, aus den Bausteinen der Einträge (`combineRecords`) */
export function itemRecords(
  items: readonly PeriodItem[],
  scoring: Scoring,
  options: { kind?: PeriodCard["kind"]; includeProbeOnly?: boolean } = {}
): PeriodRecords {
  return combineRecords(
    inOrder(items).flatMap((item) => {
      if (!recordsInView(item, options)) return []
      const candidates = item.records[scoring]
      return candidates ? [{ id: item.id, atMs: item.startedAtMs, candidates }] : []
    })
  )
}

/** wie `trainingVolume`, aus den Einträgen: Schüsse wie am Ausdruck, Einträge und Tage je Abschnitt */
export function itemVolume(
  items: readonly PeriodItem[],
  bucketOf: (atMs: number) => string,
  dayOf: (atMs: number) => string
): VolumeBucket[] {
  const buckets = new Map<string, { shots: number; cards: number; days: Set<string> }>()
  for (const item of inOrder(items)) {
    const key = bucketOf(item.startedAtMs)
    const bucket = buckets.get(key) ?? { shots: 0, cards: 0, days: new Set<string>() }
    bucket.shots += item.shots
    bucket.cards += 1
    bucket.days.add(dayOf(item.startedAtMs))
    buckets.set(key, bucket)
  }
  return [...buckets].map(([key, b]) => ({
    key,
    shots: b.shots,
    cards: b.cards,
    days: b.days.size,
  }))
}
