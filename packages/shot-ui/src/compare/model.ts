// Modell der Seite Vergleichen: zwei Seiten A und B, die Zeilen Ø je Schuss, Streuung und Lage, alle Kennzahlen und das
// Bild. Gerechnet aus dem Fachkern (`compareValues`, `compareCenterGroups`, `compareShots`, `comparePicture`), nie hier.
// Zwei Scheiben zählen Schuss für Schuss, Zeiträume und Arten über alle Schüsse mit einem Urteil über Schüsse und Abende
// (aus den Einträgen, `PeriodItem`, [[adr-034]]).

import {
  cardValues,
  compareCenterGroups,
  comparePicture,
  compareShots,
  compareValues,
  pooledValue,
  type CardValue,
  type CenterComparison,
  type ComparePicture,
  type PatternCard,
  type PeriodCard,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"
import {
  eligibleShots,
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricUnit,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { cardDetail } from "@vereinsheim/shot-core/projection"

import { detailLevel, REASON_TEXT, summaryReasons, type CardProvenance } from "../detail"
import { metricLabel } from "../labels"
import type { CompareType } from "../nav/routes"
import { itemValues, type PeriodItem } from "../period/item"
import { PERIOD_TILE_KEYS } from "../period/model"
import { shownShots } from "../shots"

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
  /** Scheiben ohne Lage der Schüsse (mit Werten) */
  withoutPosition: number
  /** Scheiben ohne Werte, sie zählen in keiner Zahl */
  withoutValues: number
  /** bei zwei Scheiben, warum eine nicht Schuss für Schuss vergleichbar ist; sonst null */
  reason: string | null
}

/** eine Kennzahl für A und B; der Vergleich mit Δ = A − B, „höher“ heißt A höher (`compareAB`, `compareShots`) */
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
  /** worüber geurteilt wird: Schuss für Schuss (zwei Scheiben) oder über Schüsse und Abende (Zeiträume, Arten) */
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

/** A gegen B über die Schüsse: Δ = A − B, „höher“ heißt A höher (wie `compareSides`) */
function compareAB(
  a: readonly CardValue[],
  b: readonly CardValue[],
  shown: Readonly<MetricDefinition>
): PeriodComparison | null {
  const result = compareValues(b, a, shown)
  return result && { ...result, a: result.b, b: result.a }
}

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
 * Zwei Gruppen von Scheiben (Zeiträume oder Arten): Werte über alle Schüsse aus den Einträgen (`pooledValue`), Ergebnis,
 * Streuung und Kacheln über `compareValues`, die Lage über alle Schüsse der Scheiben ab 3 Schuss mit Lage
 * (`compareCenterGroups`), das Bild aus allen Lagen. Ein Training nur aus Probe zählt nur mit `includeProbeOnly`, wie im Fortschritt; `positions` sind die Lagen
 * je Scheibe (fehlt eine, zählt sie weder im Bild noch als Scheibe ohne Lage).
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
    // ohne Lage ist eine Scheibe, deren Lagen gelesen und leer sind; eine, deren Lagen die Obergrenze nicht mehr gelesen
    // hat, zählt nicht dazu
    withoutPosition: items.filter(
      (item) => !withoutValues(item) && byId.get(item.id)?.points.length === 0
    ).length,
    withoutValues: items.filter(withoutValues).length,
    reason: null,
  })
  const a = counted(input.a)
  const b = counted(input.b)
  const row = (key: string): CompareRow => {
    const shown = inScoring(metric(key), scoring)
    const va = itemValues(a, metric(key), scoring, options)
    const vb = itemValues(b, metric(key), scoring, options)
    return {
      ...rowOf(key, scoring),
      a: pooledValue(va, shown),
      b: pooledValue(vb, shown),
      comparison: compareAB(va, vb, shown),
    }
  }
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
    position: compareCenterGroups(pa, pb),
    metrics: PERIOD_TILE_KEYS.map(row),
    picture: comparePicture(
      pa.flatMap((card) => card.points),
      pb.flatMap((card) => card.points)
    ),
  }
}

/** ein Eintrag ohne Werte (weder Schüsse noch Summen): Er zählt in keiner Zahl, auch nicht als Scheibe ohne Lage */
const withoutValues = (item: PeriodItem) =>
  !!item.detail && item.detail.rings === null && item.detail.tenths === null && item.shots === 0

/** Lagen der Schüsse der Seite einer Scheibe (`shownShots`), wie σ: mit Lage, ohne verdächtige */
const drawn = (card: PeriodCard) =>
  eligibleShots(metric(SPREAD_KEY), shownShots(card)).map((shot) => ({
    xUm: shot.xUm as number,
    yUm: shot.yUm as number,
  }))

/**
 * Zwei Scheiben Schuss für Schuss (`compareShots`): Die Zeilen zeigen die Werte der Scheiben (Ø je Schuss, σ), der
 * Vergleich zählt die Schüsse. Die übrigen Kennzahlen stehen ohne Vergleich da: Für sie gibt es keinen Test über Schüsse.
 * Eine Scheibe ohne Einzelschüsse (nur Summen, ohne Werte) bricht nichts: Ihre Werte aus Summen stehen da, ohne
 * Vergleich, und die Seite sagt warum (`reason`).
 */
export function cardCompareModel(input: {
  a: PeriodCard
  b: PeriodCard
  scoring: Scoring
  names: { a: SideName; b: SideName }
  /** Herkunft je Seite; ohne gilt gemessen */
  provenance?: { a?: CardProvenance; b?: CardProvenance }
}): CompareModel {
  const { scoring } = input
  const shots = compareShots(shownShots(input.a), shownShots(input.b), scoring)
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
  const side = (
    name: SideName,
    card: PeriodCard,
    count: number,
    points: number,
    provenance: CardProvenance | undefined
  ): CompareSide => {
    const detail = cardDetail(card)
    const level = detailLevel(detail, shownShots(card).length, card.sums)
    return {
      ...name,
      cards: 1,
      shots: count,
      withoutPosition: points || level === "none" ? 0 : 1,
      withoutValues: level === "none" ? 1 : 0,
      reason:
        level === "series" || level === "total"
          ? summaryReasons(detail, level).join(" · ")
          : level === "none"
            ? provenance === "printout"
              ? REASON_TEXT.waiting
              : provenance === "entered"
                ? REASON_TEXT.noValues
                : REASON_TEXT.noShot
            : null,
    }
  }
  return {
    type: "cards",
    unit: "shot",
    a: side(input.names.a, input.a, shots.shots.a, pa.length, input.provenance?.a),
    b: side(input.names.b, input.b, shots.shots.b, pb.length, input.provenance?.b),
    shared: 0,
    result: row(RESULT_KEY, shots.result),
    spread: row(SPREAD_KEY, shots.spread),
    position: shots.position,
    metrics: PERIOD_TILE_KEYS.map((key) => row(key)),
    picture: comparePicture(pa, pb),
  }
}
