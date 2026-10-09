// Modell der Seite eines Zeitraums (Plan L3, D3): alles, was die Seite zeigt, aus dem Fachkern (L2). Die
// Bausteine zeichnen nur, was hier steht; Datum und Zeitzone über `@vereinsheim/lib/format` (D16).

import {
  cardValues,
  comparePeriods,
  periodBuckets,
  periodRecords,
  periodTrend,
  trainingVolume,
  type CardValue,
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

import { metricLabel } from "../labels"
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
  { key: "group.sigma", label: "Streuung" },
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
/** bei „Alles“ vergleicht der Satz so viele letzte Tage mit ebenso vielen davor (U2, D1) */
const FORM_DAYS = 90

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
  /** gewählter Vergleich im Ø je Schuss (Ergebnis-Box, Zahlen): a der Vergleich, b der Zeitraum; Δ = Zeitraum − Vergleich */
  comparison: PeriodComparison | null
  /**
   * der Vergleich für den Satz (U2, D1: „Werde ich besser?“): der gewählte, sonst still der Zeitraum davor, bei „Alles“
   * die letzten 90 Tage gegen die 90 davor (`lastDays`); im Ø je Schuss. Er zeigt sich nicht im Verlauf und nicht in der
   * Ergebnis-Box. null ohne Scheiben im Zeitraum; mit gewähltem Vergleich nie null; bei „Alles“ ohne Scheibe in den
   * letzten 90 Tagen ein Vergleich ohne Wert (der Satz sagt „zu wenige“)
   */
  form: { comparison: PeriodComparison | null; label: string; lastDays: number | null } | null
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
   * die neueste Scheibe im Zeitraum mit Ø je Schuss (die der Ablesung ohne Wahl); null ohne. Ihren Abstand zum Schnitt
   * der fünf davor tragen `deltas` (U2, D2: ein Bezug für eine Scheibe)
   */
  newest: string | null
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
   * gewählte oder, ohne Wahl, die neueste Scheibe mit Ø je Schuss (`newest`), mit ihrem Punkt im Verlauf; null ohne
   * Scheiben
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
 * Die Ablesung zu einer Wahl: die gewählte Scheibe, wenn sie im Zeitraum liegt, sonst die neueste mit Ø je Schuss,
 * sonst die neueste. Getrennt vom Modell, damit eine neue Wahl es nicht neu rechnet.
 */
export function periodReading(
  model: Pick<PeriodModel, "cards" | "trend" | "newest">,
  chosen: string | null
): PeriodReading | null {
  const picked = chosen ? model.cards.find((c) => c.id === chosen) : undefined
  const newest = model.newest ? model.cards.find((c) => c.id === model.newest) : undefined
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

/** zeitliche Folge, bei gleichem Beginn nach Id (wie im Fachkern); eine Regel für Zeitraum und Liste */
export const byStart = (a: PeriodCard, b: PeriodCard) =>
  a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

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

  // Scheiben der Familie in der Art der Seite, auch vor dem Zeitraum: für den Abstand zum Schnitt davor
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
      label: metricLabel(metric),
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
  // der Vergleich für den Satz (D1): der gewählte, sonst still der Zeitraum davor; bei „Alles“ die letzten 90 Tage gegen
  // die 90 davor. Scheiben, die in beiden liegen, zählen nur im Zeitraum, wie beim gewählten Vergleich
  const form: PeriodModel["form"] = (() => {
    if (other) {
      return {
        comparison: tiles[0].compare?.comparison ?? null,
        label: other.label,
        lastDays: null,
      }
    }
    const all = state.choice.type === "all"
    const own = all
      ? resolveRange({ type: "rolling", days: FORM_DAYS }, { nowMs, timeZone, named, firstMs })
      : range
    const ownCards = all ? within(own) : cards
    const previous = compareRange({ type: "previous" }, own, { nowMs, timeZone, named })
    // ohne Scheiben auf der Seite kein Satz; bei „Alles“ nach einer Pause ein Vergleich ohne Wert (Review U2)
    if (!cards.length || !previous) return null
    // defensiv: der Zeitraum davor endet, wo der eigene beginnt; überlappt er doch, zählt eine Scheibe nur im eigenen
    const ownIds = new Set(ownCards.map((c) => c.id))
    const previousCards = within(previous).filter((c) => !ownIds.has(c.id))
    return {
      comparison: comparePeriods(
        cardValues(previousCards, summaryMetric, scoring, options),
        cardValues(ownCards, summaryMetric, scoring, options)
      ),
      label: previous.label,
      lastDays: all ? FORM_DAYS : null,
    }
  })()

  const model: Omit<PeriodModel, "reading"> = {
    range,
    compareRange: other,
    cards,
    metric: (() => {
      // der Name auf der Seite (U3, D4): Achse, Liste und Ablesung sagen „Streuung“, nicht „Präzision σ“
      const shown = inScoring(chartMetric, scoring)
      return { ...shown, label: metricLabel(shown) }
    })(),
    values,
    trend,
    compareValues,
    compareShared: otherAll ? otherAll.length - (otherCards?.length ?? 0) : 0,
    excludedProbeOnly: state.includeProbeOnly ? 0 : cards.filter(isProbeOnly).length,
    comparison: tiles[0].compare?.comparison ?? null,
    form,
    view: other ? "cards" : (state.view ?? (values.length >= MONTH_VIEW_FROM ? "months" : "cards")),
    months,
    deltas,
    weeks,
    newest: perShot.at(-1)?.id ?? null,
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
