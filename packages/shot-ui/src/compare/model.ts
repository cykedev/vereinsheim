// Modell der Seite Vergleichen: zwei Seiten A und B, die Zeilen Ø je Schuss, Streuung und Lage, alle Kennzahlen und das
// Bild. Gerechnet aus dem Fachkern (`compareSides`, `compareCenters`, `compareShots`, `comparePicture`), nie hier. Zwei
// Scheiben zählen Schuss für Schuss, Zeiträume und Arten Scheibe für Scheibe (aus den Einträgen, `PeriodItem`).

import {
  cardValues,
  compareCenters,
  comparePicture,
  compareShots,
  compareSides,
  positionPoints,
  type CenterComparison,
  type ComparePicture,
  type PatternCard,
  type PeriodCard,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"
import {
  asOnPrintout,
  eligibleShots,
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricUnit,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

import { metricLabel } from "../labels"
import type { CompareType } from "../nav/routes"
import { itemValues, type PeriodItem } from "../period/item"
import { PERIOD_TILE_KEYS } from "../period/model"

/** Name einer Seite: im Chip, im Satz und kurz über der Spalte („Letzte 90 Tage“, „in den letzten 90 Tagen“, „90 Tage“) */
export interface SideName {
  name: string
  at: string
  short: string
}

export interface CompareSide extends SideName {
  /** Scheiben, die zählen */
  cards: number
  /** Schüsse wie am Ausdruck */
  shots: number
  /** Scheiben ohne Lage der Schüsse */
  withoutPosition: number
}

/** eine Kennzahl für A und B; der Vergleich mit Δ = A − B, „höher“ heißt A höher (`compareSides`) */
export interface CompareRow {
  key: string
  label: string
  unit: MetricUnit
  decimals: number
  better: "higher" | "lower" | "none"
  a: number | null
  b: number | null
  comparison: PeriodComparison | null
}

export interface CompareModel {
  type: CompareType
  /** Einheit der Tests: der Schuss (zwei Scheiben) oder die Scheibe */
  unit: "shot" | "card"
  a: CompareSide
  b: CompareSide
  /** Scheiben in beiden Zeiträumen: Sie zählen nur in A */
  shared: number
  result: CompareRow
  spread: CompareRow
  position: CenterComparison | null
  /** die Kacheln des Fortschritts für A und B; bei zwei Scheiben ohne Vergleich */
  metrics: CompareRow[]
  picture: ComparePicture
}

const RESULT_KEY = "result.decimalMean"
const SPREAD_KEY = "group.sigma"

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null

/** eine Zeile ohne Werte: Name, Einheit, Stellen und Richtung der Kennzahl in der Wertung */
function rowOf(key: string, scoring: Scoring): Omit<CompareRow, "a" | "b" | "comparison"> {
  const shown = inScoring(metric(key), scoring)
  return {
    key,
    label: metricLabel(shown),
    unit: shown.unit,
    decimals: shown.decimals,
    better: shown.better,
  }
}

/**
 * Zwei Gruppen von Scheiben (Zeiträume oder Arten): Werte je Scheibe aus den Einträgen, Ergebnis und Streuung über
 * `compareSides`, die Lage über die Mitten der Scheiben (`positionPoints`, ab 3 Schuss mit Lage), das Bild aus allen
 * Lagen. Ein Training nur aus Probe zählt nur mit `includeProbeOnly`, wie im Fortschritt; `positions` sind die Lagen
 * je Scheibe (fehlt eine, hat sie keine).
 */
export function groupCompareModel(input: {
  type: "periods" | "kind"
  a: readonly PeriodItem[]
  b: readonly PeriodItem[]
  positions: readonly PatternCard[]
  scoring: Scoring
  includeProbeOnly: boolean
  names: { a: SideName; b: SideName }
  shared: number
}): CompareModel {
  const { scoring } = input
  const options = { includeProbeOnly: input.includeProbeOnly }
  const counted = (items: readonly PeriodItem[]) =>
    items.filter((item) => input.includeProbeOnly || !item.probeOnly)
  const byId = new Map(input.positions.map((card) => [card.id, card]))
  const positionsOf = (items: readonly PeriodItem[]) =>
    items.flatMap((item) => {
      const card = byId.get(item.id)
      return card && card.points.length ? [card] : []
    })
  const side = (items: readonly PeriodItem[], name: SideName): CompareSide => ({
    ...name,
    cards: items.length,
    shots: items.reduce((sum, item) => sum + item.shots, 0),
    withoutPosition: items.length - positionsOf(items).length,
  })
  const a = counted(input.a)
  const b = counted(input.b)
  const row = (key: string): CompareRow => {
    const va = itemValues(a, metric(key), scoring, options).map((v) => v.value)
    const vb = itemValues(b, metric(key), scoring, options).map((v) => v.value)
    return { ...rowOf(key, scoring), a: mean(va), b: mean(vb), comparison: compareSides(va, vb) }
  }
  const centers = (cards: readonly PatternCard[]) => positionPoints(cards).map((p) => p.center)
  const pa = positionsOf(a)
  const pb = positionsOf(b)
  return {
    type: input.type,
    unit: "card",
    a: side(a, input.names.a),
    b: side(b, input.names.b),
    shared: input.shared,
    result: row(RESULT_KEY),
    spread: row(SPREAD_KEY),
    position: compareCenters(centers(pa), centers(pb)),
    metrics: PERIOD_TILE_KEYS.map(row),
    picture: comparePicture(
      pa.flatMap((card) => card.points),
      pb.flatMap((card) => card.points)
    ),
  }
}

/** Lagen der Wertungsschüsse wie am Ausdruck, wie σ: mit Lage, ohne verdächtige */
const drawn = (card: PeriodCard) =>
  eligibleShots(metric(SPREAD_KEY), asOnPrintout(card.shots)).map((shot) => ({
    xUm: shot.xUm as number,
    yUm: shot.yUm as number,
  }))

/**
 * Zwei Scheiben Schuss für Schuss (`compareShots`): Die Zeilen zeigen die Werte der Scheiben (Ø je Schuss, σ), der
 * Vergleich zählt die Schüsse. Die übrigen Kennzahlen stehen ohne Vergleich da: Für sie gibt es keinen Test über Schüsse.
 */
export function cardCompareModel(input: {
  a: PeriodCard
  b: PeriodCard
  scoring: Scoring
  names: { a: SideName; b: SideName }
}): CompareModel {
  const { scoring } = input
  const shots = compareShots(input.a.shots, input.b.shots, scoring)
  const valueOf = (card: PeriodCard, key: string) =>
    cardValues([card], metric(key), scoring, { includeProbeOnly: true })[0]?.value ?? null
  const row = (key: string, comparison: PeriodComparison | null = null): CompareRow => ({
    ...rowOf(key, scoring),
    a: valueOf(input.a, key),
    b: valueOf(input.b, key),
    comparison,
  })
  const pa = drawn(input.a)
  const pb = drawn(input.b)
  const side = (name: SideName, count: number, points: number): CompareSide => ({
    ...name,
    cards: 1,
    shots: count,
    withoutPosition: points ? 0 : 1,
  })
  return {
    type: "cards",
    unit: "shot",
    a: side(input.names.a, shots.shots.a, pa.length),
    b: side(input.names.b, shots.shots.b, pb.length),
    shared: 0,
    result: row(RESULT_KEY, shots.result),
    spread: row(SPREAD_KEY, shots.spread),
    position: shots.position,
    metrics: PERIOD_TILE_KEYS.map((key) => row(key)),
    picture: comparePicture(pa, pb),
  }
}
