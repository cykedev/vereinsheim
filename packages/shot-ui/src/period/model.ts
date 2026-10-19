// Modell der Seite eines Zeitraums: alles, was die Seite zeigt, aus dem Fachkern. Die Bausteine zeichnen nur, was hier
// steht; Datum und Zeitzone über `@vereinsheim/lib/format`. Es rechnet aus einem schlanken Eintrag je Scheibe oder
// Einheit (`PeriodItem`), nie aus Schüssen: Spiegel bildet ihn aus der Projektion (`fromProjection`, ADR-031),
// Treffsicher aus einer Einheit.

import {
  comparePeriods,
  periodBuckets,
  periodTrend,
  type CardValue,
  type PeriodBucket,
  type PeriodComparison,
  type PeriodRecords,
  type TrendPoint,
  type VolumeBucket,
} from "@vereinsheim/shot-core/analysis"
import type { ProjectedCard } from "@vereinsheim/shot-core/projection"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricShot,
  type MetricUnit,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { formatIsoDate, formatMonthYear, zonedDayStartMs } from "@vereinsheim/lib/format"

import { metricLabel } from "../labels"
import {
  compareRange,
  eveningDay,
  inRange,
  isoWeekKey,
  resolveRange,
  weekLabel,
  weeksBetween,
  type DateRange,
  type NamedPeriod,
} from "./calendar"
import { byStart, itemRecords, itemValues, itemVolume, type PeriodItem } from "./item"
import type { PeriodMetricKey, PeriodState } from "./state"

export type { PeriodItem } from "./item"

/** Kennzahlen des Verlaufs mit kurzem Namen für den Umschalter */
export const PERIOD_CHART_METRICS: readonly { key: PeriodMetricKey; label: string }[] = [
  { key: "result.decimalMean", label: "Ø je Schuss" },
  { key: "group.sigma", label: "Streuung" },
  { key: "result.tensRate", label: "Zehner" },
  { key: "time.intervalMedian", label: "Tempo" },
]

/**
 * Kacheln über den Zeitraum: nur Kennzahlen, die nicht an der Schusszahl hängen; sechs, damit sie auf dem
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

/**
 * eine Kennzahl, wie die Seite sie zeigt: ihre Angaben ohne `compute`. Funktionen gehen nicht vom Server zum Browser
 * (Fortschritt in der App), die Bausteine lesen nur Schlüssel, Name, Einheit, Stellen und Richtung
 */
export type PeriodMetric = Readonly<Omit<MetricDefinition, "compute">>

/** ab so vielen Scheiben zeigt der Verlauf je Monat, bis der Schütze selbst wählt */
export const MONTH_VIEW_FROM = 60

const SUMMARY_KEY = "result.decimalMean"
/** bei „Alles“ vergleicht der Satz so viele letzte Tage mit ebenso vielen davor */
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
  cards: PeriodItem[]
  /** die Kennzahl des Verlaufs in der Wertung der Seite, ohne ihre Rechnung (das Modell geht vom Server zum Browser) */
  metric: PeriodMetric
  values: CardValue[]
  trend: { points: TrendPoint[]; spread: number | null }
  /** Werte der Kennzahl im Vergleichszeitraum, für den Verlauf; null ohne Vergleich */
  compareValues: CardValue[] | null
  /**
   * Scheiben, die in beiden Zeiträumen liegen: Sie zählen nur im Zeitraum, nicht im Vergleich, denn ein Test
   * braucht zwei getrennte Stichproben
   */
  compareShared: number
  /** Scheiben nur aus Probe im Zeitraum, die ohne den Schalter nicht zählen */
  excludedProbeOnly: number
  /** gewählter Vergleich im Ø je Schuss (Ergebnis-Box, Zahlen): a der Vergleich, b der Zeitraum; Δ = Zeitraum − Vergleich */
  comparison: PeriodComparison | null
  /**
   * der Vergleich für den Satz („Werde ich besser?“): der gewählte, sonst still der Zeitraum davor, bei „Alles“
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
  /** Trainingstage für den Kalender (T7): erster und letzter Tag des Zeitraums (höchstens heute), Tage mit Scheiben */
  /**
   * Kalender: Tage des Zeitraums (`from` bis `to`, `days` in ihm), dazu alle Trainingstage der Familie in der Art (`all`)
   * und heute, zum Blättern
   */
  calendar: { from: string; to: string; days: CalendarDay[]; all: CalendarDay[]; today: string }
  /**
   * die neueste Scheibe im Zeitraum mit Ø je Schuss (die der Ablesung ohne Wahl); null ohne. Ihren Abstand zum Schnitt
   * der fünf davor tragen `deltas` (ein Bezug für eine Scheibe)
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
  card: PeriodItem
  point: TrendPoint | null
  chosen: boolean
}

/**
 * eine Scheibe nur aus Probe (Training): eine Regel für Modell und Bausteine. Mit mindestens einem Schuss: eine Scheibe
 * ohne Schuss ist keine Probe
 */
export const isProbeOnly = (card: ProjectedCard) =>
  card.projection.probeOnly && card.projection.printedShots > 0

/** Art einer Scheibe in den Listen: Wettkampf, Training, Training nur aus Probe */
export type CardKind = "training" | "competition" | "probe"

export const cardKind = (card: ProjectedCard): CardKind => kindOf(card.kind, isProbeOnly(card))

/** Art eines Eintrags der Seite eines Zeitraums, wie `cardKind` */
export const itemKind = (item: PeriodItem): CardKind => kindOf(item.kind, item.probeOnly)

/** die Art aus Wettkampf oder Training und „nur Probe“: eine Regel für die Übersichten und die Seite einer Scheibe */
export const kindOf = (kind: PeriodItem["kind"], probeOnly: boolean): CardKind =>
  kind === "competition" ? "competition" : probeOnly ? "probe" : "training"

/** „nur Probe“ aus den Schüssen, für die Seite einer Scheibe (sie hat Schüsse statt Projektion); wie `isProbeOnly` */
export const probeOnlyShots = (shots: readonly Pick<MetricShot, "kind">[]) =>
  shots.length > 0 && shots.every((s) => s.kind === "probe")

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

export { byStart } from "./item"

/** die bis zu fünf Scheiben davor, wie der gleitende Schnitt */
const DELTA_WINDOW = 5

/**
 * Abstand jedes Werts zum Mittel der bis zu `window` Werte davor, ohne den Wert selbst;
 * der erste hat keinen. Mit `ids` nur für diese Werte, gerechnet über alle davor, auch außerhalb des Zeitraums.
 * Geteilt von der Seite eines Zeitraums und der Scheiben-Liste.
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

/** ein Trainingstag: der Abend (vor 4 Uhr der Vortag, wie in der Liste), Schüsse wie am Ausdruck, Scheiben, davon Wettkampf */
export interface CalendarDay {
  key: string
  shots: number
  cards: number
  competition: number
}

/**
 * die Tage des Kalenders aus den Scheiben des Zeitraums: der Umfang (`itemVolume`, T6/T7) je Abend wie die Liste
 * (`eveningDay`), dazu die Zahl der Wettkämpfe
 */
function calendarDays(cards: readonly PeriodItem[], timeZone: string): CalendarDay[] {
  const evening = (ms: number) => eveningDay(ms, timeZone)
  const competition = new Map<string, number>()
  for (const card of cards)
    if (card.kind === "competition") {
      const key = evening(card.startedAtMs)
      competition.set(key, (competition.get(key) ?? 0) + 1)
    }
  return itemVolume(cards, evening, evening)
    .map(({ key, shots, cards }) => ({ key, shots, cards, competition: competition.get(key) ?? 0 }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
}

/**
 * Tage des Zeitraums für Umfang und Kalender: vom ersten Tag (oder dem früheren Abend einer Scheibe vor 4 Uhr am ersten
 * Tag) bis zum letzten, höchstens heute
 */
function calendarOf(
  range: DateRange,
  nowMs: number,
  cards: readonly PeriodItem[],
  family: readonly PeriodItem[],
  timeZone: string
): PeriodModel["calendar"] {
  const days = calendarDays(cards, timeZone)
  const first = formatIsoDate(new Date(range.fromMs), timeZone)
  return {
    from: days[0] && days[0].key < first ? days[0].key : first,
    to: formatIsoDate(new Date(Math.min(range.toMs, nowMs + 1) - 1), timeZone),
    days,
    all: calendarDays(family, timeZone),
    today: formatIsoDate(new Date(nowMs), timeZone),
  }
}

export function periodModel(input: {
  /** alle Scheiben einer Familie (in Spiegel `fromProjection`) */
  items: readonly PeriodItem[]
  state: PeriodState
  nowMs: number
  timeZone: string
  named: readonly NamedPeriod[]
}): PeriodModel {
  const { state, nowMs, timeZone, named } = input
  const options = { includeProbeOnly: state.includeProbeOnly }
  const scoring: Scoring = state.scoring
  const ofKind = (card: PeriodItem) => state.kind === "all" || card.kind === state.kind
  const firstMs = input.items.length ? Math.min(...input.items.map((c) => c.startedAtMs)) : null
  const range = resolveRange(state.choice, { nowMs, timeZone, named, firstMs })
  const other = compareRange(state.compare, range, { nowMs, timeZone, named })
  const within = (r: DateRange) =>
    input.items.filter((c) => inRange(c.startedAtMs, r) && ofKind(c)).sort(byStart)
  const cards = within(range)
  const inPeriod = new Set(cards.map((c) => c.id))
  const otherAll = other ? within(other) : null
  const otherCards = otherAll ? otherAll.filter((c) => !inPeriod.has(c.id)) : null

  const chartMetric = metricByKey(state.metric) as Readonly<MetricDefinition>
  const values = itemValues(cards, chartMetric, scoring, options)
  const trend = periodTrend(values)
  const compareValues = otherCards ? itemValues(otherCards, chartMetric, scoring, options) : null

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
  const family = input.items.filter(ofKind).sort(byStart)
  const familyValues = itemValues(family, chartMetric, scoring, options)
  const deltas = deltasBefore(familyValues, inPeriod)
  // je Abend wie die Liste (vor 4 Uhr der Vortag), für Wochen und Kalender gleich
  const evening = (ms: number) => eveningDay(ms, timeZone)
  const volume = new Map(
    itemVolume(cards, (ms) => isoWeekKey(evening(ms)), evening).map((w) => [w.key, w])
  )
  const calendar = calendarOf(range, nowMs, cards, family, timeZone)
  const weeks = weeksBetween(calendar.from, calendar.to).map(({ key }) => ({
    ...(volume.get(key) ?? { key, shots: 0, cards: 0, days: 0 }),
    label: weekLabel(key),
  }))

  const tiles: PeriodTile[] = PERIOD_TILE_KEYS.map((key) => {
    const base = metricByKey(key) as Readonly<MetricDefinition>
    const metric = inScoring(base, scoring)
    const own = itemValues(cards, base, scoring, options)
    const theirs = otherCards ? itemValues(otherCards, base, scoring, options) : null
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
  const perShot = itemValues(cards, summaryMetric, scoring, options)
  // beste Scheibe nur unter gleicher Schusszahl: eine kurze Scheibe hat leichter einen hohen Ø (wie R1)
  const counts = new Map<number, number>()
  for (const value of perShot) counts.set(value.n, (counts.get(value.n) ?? 0) + 1)
  const usual = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
  let best: CardValue | null = null
  for (const value of perShot) {
    if (value.n === usual && (!best || value.value > best.value)) best = value
  }
  // der Vergleich für den Satz: der gewählte, sonst still der Zeitraum davor; bei „Alles“ die letzten 90 Tage gegen
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
    // ohne Scheiben auf der Seite kein Satz; bei „Alles“ nach einer Pause ein Vergleich ohne Wert
    if (!cards.length || !previous) return null
    // defensiv: der Zeitraum davor endet, wo der eigene beginnt; überlappt er doch, zählt eine Scheibe nur im eigenen
    const ownIds = new Set(ownCards.map((c) => c.id))
    const previousCards = within(previous).filter((c) => !ownIds.has(c.id))
    return {
      comparison: comparePeriods(
        itemValues(previousCards, summaryMetric, scoring, options),
        itemValues(ownCards, summaryMetric, scoring, options)
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
      // der Name auf der Seite: Achse, Liste und Ablesung sagen „Streuung“, nicht „Präzision σ“
      const { compute: _compute, ...shown } = inScoring(chartMetric, scoring)
      return { ...shown, label: metricLabel(shown) }
    })(),
    values,
    trend,
    compareValues,
    compareShared: otherAll ? otherAll.length - (otherCards?.length ?? 0) : 0,
    excludedProbeOnly: state.includeProbeOnly ? 0 : cards.filter((c) => c.probeOnly).length,
    comparison: tiles[0].compare?.comparison ?? null,
    form,
    view: other ? "cards" : (state.view ?? (values.length >= MONTH_VIEW_FROM ? "months" : "cards")),
    months,
    deltas,
    weeks,
    calendar,
    newest: perShot.at(-1)?.id ?? null,
    records: itemRecords(input.items, scoring, {
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

/**
 * ein Eintrag für den Browser: nur die Felder von `PeriodItem` (eine App reicht mehr herein), ohne Werte und Rekorde
 * (die Bausteine lesen Art, „nur Probe“ und Schusszahl)
 */
const lightCard = (card: PeriodItem): PeriodItem => ({
  id: card.id,
  startedAtMs: card.startedAtMs,
  kind: card.kind,
  probeOnly: card.probeOnly,
  shots: card.shots,
  metrics: {},
  records: { decimal: null, rings: null },
  flags: card.flags,
})

/**
 * Das Modell für den Browser (Fortschritt in der App): Rechnet der Server `periodModel`, gehen die Scheiben ohne
 * ihre Werte und Rekorde mit. Die Bausteine (`PeriodChart`, `CardList`, `CardReadout`, `PeriodResult`,
 * `PeriodInsights`) lesen von einer Scheibe nur Id, Beginn, Art, „nur Probe“ und Schusszahl; die Werte der Kennzahl
 * stehen in `values`. Ein Test hält fest, dass sie damit dasselbe zeichnen. Auf dem leichten Modell nicht neu rechnen.
 */
export function lightPeriodModel(model: PeriodModel): PeriodModel {
  const cards = model.cards.map(lightCard)
  const byId = new Map(cards.map((card) => [card.id, card]))
  return {
    ...model,
    cards,
    reading: model.reading
      ? { ...model.reading, card: byId.get(model.reading.card.id) ?? lightCard(model.reading.card) }
      : null,
  }
}
