// Modell der Seite eines Zeitraums (Plan L3, D3): alles, was die Seite zeigt, aus dem Fachkern (L2). Die
// Bausteine zeichnen nur, was hier steht; Datum und Zeitzone über `@vereinsheim/lib/format` (D16).

import {
  againstOwnAverage,
  cardValues,
  comparePeriods,
  periodBuckets,
  periodRecords,
  periodTrend,
  trainingVolume,
  type CardValue,
  type OwnAverage,
  type PeriodBucket,
  type PeriodCard,
  type PeriodComparison,
  type PeriodRecords,
  type TrendPoint,
  type VolumeBucket,
} from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricUnit,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { formatIsoDate, formatMonthYear, zonedDayStartMs } from "@vereinsheim/lib/format"

import {
  compareRange,
  DAY_MS,
  inRange,
  isoWeekKey,
  resolveRange,
  weekLabel,
  type DateRange,
  type NamedPeriod,
} from "./calendar"
import type { PeriodMetricKey, PeriodState } from "./state"

/** Kennzahlen des Verlaufs mit kurzem Namen für den Umschalter (D7) */
export const PERIOD_CHART_METRICS: readonly { key: PeriodMetricKey; label: string }[] = [
  { key: "result.decimalMean", label: "Ø je Schuss" },
  { key: "group.sigma", label: "σ" },
  { key: "result.tensRate", label: "Zehner" },
  { key: "time.intervalMedian", label: "Tempo" },
]

/**
 * Kacheln über den Zeitraum (D11): nur Kennzahlen, die nicht an der Schusszahl hängen; sechs, damit sie auf dem
 * Telefon (zwei Spalten) und am Desktop (drei) jede Zeile füllen
 */
export const PERIOD_TILE_KEYS = [
  "result.decimalMean",
  "result.tensRate",
  "group.sigma",
  "group.sdX",
  "group.sdY",
  "time.intervalMedian",
] as const

/** ab so vielen Scheiben zeigt der Verlauf je Monat, bis der Schütze selbst wählt (D7) */
export const MONTH_VIEW_FROM = 60

const SUMMARY_KEY = "result.decimalMean"

export interface PeriodTile {
  key: string
  label: string
  unit: MetricUnit
  decimals: number
  better: "higher" | "lower" | "none"
  /** Mittel der Werte je Scheibe; null ohne Scheibe mit Wert */
  value: number | null
  /** Scheiben mit Wert */
  n: number
  /** mit Vergleich: Wert und n der anderen Seite, der Vergleich (Seite a ist der Vergleich, b der Zeitraum) */
  compare: { value: number | null; n: number; comparison: PeriodComparison | null } | null
}

export interface PeriodModel {
  range: DateRange
  compareRange: DateRange | null
  /** Scheiben im Zeitraum nach Art, in ihrer Folge (Beginn, Id) */
  cards: PeriodCard[]
  /** die Kennzahl des Verlaufs in der Wertung der Seite */
  metric: Readonly<MetricDefinition>
  values: CardValue[]
  trend: { points: TrendPoint[]; spread: number | null }
  /** Werte der Kennzahl im Vergleichszeitraum, für den Verlauf; null ohne Vergleich */
  compareValues: CardValue[] | null
  /**
   * Scheiben, die in beiden Zeiträumen liegen: Sie zählen nur im Zeitraum, nicht im Vergleich, denn ein Test
   * braucht zwei getrennte Stichproben (Review, 9. Oktober 2026)
   */
  compareShared: number
  /** Scheiben nur aus Probe im Zeitraum, die ohne den Schalter nicht zählen (L2, D8) */
  excludedProbeOnly: number
  /** Vergleich im Ø je Schuss (Ergebnis-Box, Satz): a der Vergleich, b der Zeitraum; Δ = Zeitraum − Vergleich */
  comparison: PeriodComparison | null
  view: "cards" | "months"
  /**
   * je Monat Median, P10 und P90 (T5); Boden und Decke nach der Richtung der Kennzahl: Ist höher besser, ist der
   * Boden das P10, ist kleiner besser (σ), das P90; ohne Richtung (Tempo) keine, nur die Spanne
   */
  months: (PeriodBucket & {
    label: string
    atMs: number
    floor: number | null
    ceiling: number | null
  })[]
  /**
   * Abstand jeder Scheibe im Zeitraum zum Schnitt der bis zu fünf Scheiben davor (in der Familie, auch vor dem
   * Zeitraum), ohne sie selbst; die erste Scheibe der Familie hat keinen
   */
  deltas: Map<string, { delta: number; n: number }>
  /** jede ISO-Woche im Zeitraum, auch ohne Scheibe */
  weeks: (VolumeBucket & { label: string })[]
  /**
   * die neueste Scheibe im Zeitraum gegen den eigenen Schnitt, im Ø je Schuss, über alle Scheiben der Familie
   * bis zu ihr (30 Tage davor, Platz unter den letzten 50)
   */
  ownAverage: (OwnAverage & { pool: number }) | null
  records: PeriodRecords
  summary: {
    mean: number | null
    cards: number
    shots: number
    /** beste Scheibe (Ø je Schuss) unter der häufigsten Schusszahl, bei Gleichstand der längeren */
    best: (CardValue & { shots: number }) | null
  }
  tiles: PeriodTile[]
  /**
   * gewählte oder, ohne Wahl, die neueste Scheibe mit Ø je Schuss (dieselbe wie im Satz und bei „gegen deinen
   * Schnitt“), mit ihrem Punkt im Verlauf; null ohne Scheiben
   */
  reading: PeriodReading | null
}

export interface PeriodReading {
  card: PeriodCard
  point: TrendPoint | null
  chosen: boolean
}

/** eine Scheibe nur aus Probe (Training): eine Regel für Modell und Bausteine */
export const isProbeOnly = (card: PeriodCard) =>
  card.shots.length > 0 && card.shots.every((s) => s.kind === "probe")

/**
 * Die Ablesung zu einer Wahl: die gewählte Scheibe, wenn sie im Zeitraum liegt, sonst die neueste mit Ø je Schuss
 * (wie im Satz und bei „gegen deinen Schnitt“), sonst die neueste. Getrennt vom Modell, damit eine neue Wahl es
 * nicht neu rechnet.
 */
export function periodReading(
  model: Pick<PeriodModel, "cards" | "trend" | "ownAverage">,
  chosen: string | null
): PeriodReading | null {
  const picked = chosen ? model.cards.find((c) => c.id === chosen) : undefined
  const newest = model.ownAverage
    ? model.cards.find((c) => c.id === model.ownAverage?.last.id)
    : undefined
  const card = picked ?? newest ?? model.cards.at(-1)
  if (!card) return null
  return {
    card,
    point: model.trend.points.find((p) => p.id === card.id) ?? null,
    chosen: Boolean(picked),
  }
}

const mean = (values: readonly CardValue[]) =>
  values.length ? values.reduce((sum, v) => sum + v.value, 0) / values.length : null

const byStart = (a: PeriodCard, b: PeriodCard) =>
  a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Platz unter so vielen letzten Scheiben (C4) */
const PERCENTILE_POOL = 50

/** gegen den eigenen Schnitt, mit der Zahl der Scheiben, unter denen der Platz gilt (bis zu 50) */
function ownAverageOf(values: readonly CardValue[]) {
  const own = againstOwnAverage(values)
  return own ? { ...own, pool: Math.min(PERCENTILE_POOL, values.length) } : null
}

/** die bis zu fünf Scheiben davor, wie der gleitende Schnitt (D2) */
const DELTA_WINDOW = 5

/**
 * Abstand jedes Werts zum Mittel der bis zu `window` Werte davor, ohne den Wert selbst (Prüfung, 9. Oktober 2026);
 * der erste hat keinen. Mit `ids` nur für diese Werte, gerechnet über alle davor, auch außerhalb des Zeitraums.
 * Geteilt von der Seite eines Zeitraums und der Scheiben-Liste (Plan N2).
 */
export function deltasBefore(
  values: readonly CardValue[],
  ids: ReadonlySet<string> | null,
  window = DELTA_WINDOW
): Map<string, { delta: number; n: number }> {
  const deltas = new Map<string, { delta: number; n: number }>()
  values.forEach((value, i) => {
    if (!i || (ids && !ids.has(value.id))) return
    const before = values.slice(Math.max(0, i - window), i)
    deltas.set(value.id, { delta: value.value - (mean(before) as number), n: before.length })
  })
  return deltas
}

/** jede ISO-Woche vom Beginn bis zum Ende des Zeitraums (höchstens bis jetzt), in der Zeitzone */
function weekKeys(range: DateRange, nowMs: number, timeZone: string): string[] {
  const end = Math.min(range.toMs, nowMs + 1) - 1
  const keys = new Set<string>()
  for (let t = range.fromMs; t <= end; t += DAY_MS) {
    keys.add(isoWeekKey(formatIsoDate(new Date(t), timeZone)))
  }
  keys.add(isoWeekKey(formatIsoDate(new Date(end), timeZone)))
  return [...keys]
}

export function periodModel(input: {
  /** alle Scheiben einer Familie */
  cards: readonly PeriodCard[]
  state: PeriodState
  nowMs: number
  timeZone: string
  named: readonly NamedPeriod[]
}): PeriodModel {
  const { state, nowMs, timeZone, named } = input
  const options = { includeProbeOnly: state.includeProbeOnly }
  const scoring: Scoring = state.scoring
  const ofKind = (card: PeriodCard) => state.kind === "all" || card.kind === state.kind
  const firstMs = input.cards.length ? Math.min(...input.cards.map((c) => c.startedAtMs)) : null
  const range = resolveRange(state.choice, { nowMs, timeZone, named, firstMs })
  const other = compareRange(state.compare, range, { nowMs, timeZone, named })
  const within = (r: DateRange) =>
    input.cards.filter((c) => inRange(c.startedAtMs, r) && ofKind(c)).sort(byStart)
  const cards = within(range)
  const inPeriod = new Set(cards.map((c) => c.id))
  const otherAll = other ? within(other) : null
  const otherCards = otherAll ? otherAll.filter((c) => !inPeriod.has(c.id)) : null

  const chartMetric = metricByKey(state.metric) as Readonly<MetricDefinition>
  const values = cardValues(cards, chartMetric, scoring, options)
  const trend = periodTrend(values)
  const compareValues = otherCards ? cardValues(otherCards, chartMetric, scoring, options) : null

  const day = (ms: number) => formatIsoDate(new Date(ms), timeZone)
  const better = chartMetric.better
  const months = periodBuckets(values, (ms) => day(ms).slice(0, 7)).map((bucket) => {
    const atMs = zonedDayStartMs(`${bucket.key}-01`, timeZone)
    return {
      ...bucket,
      atMs,
      label: formatMonthYear(new Date(atMs), timeZone),
      floor: better === "higher" ? bucket.p10 : better === "lower" ? bucket.p90 : null,
      ceiling: better === "higher" ? bucket.p90 : better === "lower" ? bucket.p10 : null,
    }
  })

  // Scheiben der Familie in der Art der Seite, auch vor dem Zeitraum: für den Abstand zum Schnitt davor und
  // für „gegen deinen Schnitt“ (Platz unter den letzten 50, nicht nur im Zeitraum)
  const family = input.cards.filter(ofKind).sort(byStart)
  const familyValues = cardValues(family, chartMetric, scoring, options)
  const deltas = deltasBefore(familyValues, inPeriod)
  const volume = new Map(
    trainingVolume(cards, (ms) => isoWeekKey(day(ms)), day).map((w) => [w.key, w])
  )
  const weeks = weekKeys(range, nowMs, timeZone).map((key) => ({
    ...(volume.get(key) ?? { key, shots: 0, cards: 0, days: 0 }),
    label: weekLabel(key),
  }))

  const tiles: PeriodTile[] = PERIOD_TILE_KEYS.map((key) => {
    const base = metricByKey(key) as Readonly<MetricDefinition>
    const metric = inScoring(base, scoring)
    const own = cardValues(cards, base, scoring, options)
    const theirs = otherCards ? cardValues(otherCards, base, scoring, options) : null
    return {
      key,
      label: metric.label,
      unit: metric.unit,
      decimals: metric.decimals,
      better: metric.better,
      value: mean(own),
      n: own.length,
      compare: theirs
        ? { value: mean(theirs), n: theirs.length, comparison: comparePeriods(theirs, own) }
        : null,
    }
  })

  const summaryMetric = metricByKey(SUMMARY_KEY) as MetricDefinition
  const perShot = cardValues(cards, summaryMetric, scoring, options)
  // beste Scheibe nur unter gleicher Schusszahl: eine kurze Scheibe hat leichter einen hohen Ø (wie R1)
  const counts = new Map<number, number>()
  for (const value of perShot) counts.set(value.n, (counts.get(value.n) ?? 0) + 1)
  const usual = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
  let best: CardValue | null = null
  for (const value of perShot) {
    if (value.n === usual && (!best || value.value > best.value)) best = value
  }
  const familyPerShot = cardValues(family, summaryMetric, scoring, options)
  const newest = perShot.at(-1)
  const upToNewest = newest
    ? familyPerShot.slice(0, familyPerShot.findIndex((v) => v.id === newest.id) + 1)
    : []

  const model: Omit<PeriodModel, "reading"> = {
    range,
    compareRange: other,
    cards,
    metric: inScoring(chartMetric, scoring),
    values,
    trend,
    compareValues,
    compareShared: otherAll ? otherAll.length - (otherCards?.length ?? 0) : 0,
    excludedProbeOnly: state.includeProbeOnly ? 0 : cards.filter(isProbeOnly).length,
    comparison: tiles[0].compare?.comparison ?? null,
    view: other ? "cards" : (state.view ?? (values.length >= MONTH_VIEW_FROM ? "months" : "cards")),
    months,
    deltas,
    weeks,
    ownAverage: ownAverageOf(upToNewest),
    records: periodRecords(input.cards, scoring, {
      kind: state.kind === "all" ? undefined : state.kind,
      includeProbeOnly: state.includeProbeOnly,
    }),
    summary: {
      mean: mean(perShot),
      cards: perShot.length,
      shots: perShot.reduce((sum, v) => sum + v.n, 0),
      best: best ? { ...best, shots: best.n } : null,
    },
    tiles,
  }
  return { ...model, reading: periodReading(model, state.chosen) }
}
