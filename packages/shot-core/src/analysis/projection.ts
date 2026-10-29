// Projektion je Scheibe (ADR-031): was die Seiten über viele Scheiben brauchen, einmal beim Schreiben
// einer Revision aus den Schüssen gerechnet. Die Übersichten (Liste, Fortschritt, Start) lesen dann eine Zeile je
// Scheibe statt aller Schüsse; die Seite einer Scheibe rechnet weiter live. Was hier zusammengeführt wird, ist
// gleich der Rechnung aus den Schüssen (`cardValues`, `periodRecords`); der Test hält das fest.

import { centroid } from "../geometry"
import {
  FLAG_SUSPICIOUS,
  METRICS,
  asOnPrintout,
  computeMetric,
  eligibleShots,
  inScoring,
  inShotOrder,
  metricByKey,
  isDrawn,
  selectShots,
  sumsResult,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
  type SumSource,
} from "../metrics"
import { byStart, cardShots, probeOnlyCard, shotCountOf } from "./card-shots"
import { pooledValue } from "./levels"
import { cardValues, type CardValue, type PeriodCard, type VolumeBucket } from "./period"
import {
  RECORD_EXCLUDING_FLAGS,
  cardRecordCandidates,
  combineRecords,
  type PeriodRecords,
  type RecordCandidates,
} from "./records"

/**
 * Stand der Rechnung, die nicht in den Versionen der Kennzahlen steht: Form der Projektion, die Kandidaten der Rekorde
 * (`cardRecordCandidates`) und die Lagen (`cardMarks`), die mit ihr gespeichert werden. Erhöhen, wenn sich eins davon
 * ändert; dann werden alle Projektionen neu gerechnet. 2: Lagen für die kleinen Scheiben. 3: ohne verdächtige Schüsse
 * (SF-15). 4: Zehner und Innenzehner je Serie, Folge ab 9, schwächster Schuss, Spanne der Serien. 5: Streuung der
 * Schusswerte (`sd`) der Kennzahlen, die sich über Schüsse mitteln. 6: Angaben ohne Einzelschüsse (Summen, Trefferlage
 * als Summe), die Grundlage (`detail`), nur Probe erst mit einem Schuss.
 */
const PROJECTION_VERSION = 6

const CARD_METRICS = METRICS.filter((metric) => metric.scopes.includes("card"))
const RESULT_RINGS = metricByKey("result.rings") as MetricDefinition
const RESULT_DECIMAL = metricByKey("result.decimal") as MetricDefinition
const MPI_DISTANCE = metricByKey("group.mpiDistance") as MetricDefinition

/** woher ein Wert kommt: aus den Einzelschüssen oder aus Summen */
export type ValueSource = "shots" | SumSource

/**
 * Grundlage der Werte einer Scheibe ([[adr-033]]): woher das Ergebnis je Wertung kommt (null: keins), wie viele Schüsse
 * wie am Ausdruck eine Lage und eine Zeit haben, und die Mitte der Schüsse aus den Lagen je Schuss oder aus der
 * Trefferlage als Summe, mit ihrer Schusszahl
 */
export interface CardDetail {
  rings: ValueSource | null
  tenths: ValueSource | null
  positions: number
  times: number
  center: { xUm: number; yUm: number; n: number; from: "shots" | "summary" } | null
}

/** die Mitte der Schüsse einer Scheibe mit ihrer Schusszahl */
export type CardCenter = NonNullable<CardDetail["center"]>

export { pooledCenter } from "./center"
export { probeOnlyCard, sightersBesideSums } from "./card-shots"

export interface CardProjection {
  /** `projectionVersion(METRICS)` beim Rechnen; weicht sie ab, ist die Projektion veraltet */
  version: string
  /** nur Probe: die Werte rechnen über die Probe wie Wertung; ob sie zählt, sagt beim Lesen `warmup` */
  probeOnly: boolean
  /** ein verdächtiger Schuss unter denen, die zählen: keine Rekorde (SF-15) */
  suspicious: boolean
  /** Schüsse wie am Ausdruck (Wertung, bei nur Probe die Probe) */
  printedShots: number
  /** jede Kennzahl der Ebene Scheibe in beiden Wertungen, nach Schlüssel; fehlt ohne Wert */
  values: Record<string, { value: number; n: number; sd?: number | null }>
  /** Rekord-Kandidaten je Wertung; null ohne Schüsse */
  records: Record<Scoring, RecordCandidates | null>
  /** fehlt in Projektionen vor Version 6, bis `refreshProjections` sie nachrechnet; `cardProjection` liefert sie immer */
  detail?: CardDetail
}

/** eine Scheibe, wie sie die Übersichten aus der Datenbank lesen: ihre Merkmale und die Projektion, ohne Schüsse */
export interface ProjectedCard {
  id: string
  startedAtMs: number
  kind: PeriodCard["kind"]
  complete: boolean
  flags: readonly string[]
  /** amtliche Wertung der Disziplin wie `PeriodCard.official`; fehlt, wenn sie unbekannt ist */
  official?: Scoring
  /**
   * die Wertung der Scheibe (in der App gewählt, sonst die Wertung der Disziplin, sonst die Anzeige am Stand); fehlt
   * sie (etwa in Tests), gilt die der Disziplin
   */
  scoring?: Scoring
  projection: CardProjection
  /** Einschießen (`warmupIds`): beim Lesen gesetzt (`markWarmup`), nie in der Projektion gespeichert */
  warmup?: true
}

/** FNV-1a über 32 Bit, als acht Hex-Ziffern: kurz, stabil und ohne Abhängigkeit (Browser und Server) */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/**
 * Version der Projektion: `PROJECTION_VERSION` und ein Fingerabdruck über Schlüssel und Version jeder Kennzahl. Steigt
 * eine Kennzahl-Version, ändert sie sich, und die gespeicherten Projektionen gelten als veraltet.
 */
export function projectionVersion(
  metrics: readonly Readonly<MetricDefinition>[] = METRICS
): string {
  const parts = metrics.map((metric) => `${metric.key}@${metric.version}`).sort()
  return `p${PROJECTION_VERSION}-${fnv1a(parts.join("|"))}`
}

/** die Grundlage der Werte einer Scheibe (`CardDetail`), über die Schüsse wie am Ausdruck und ihre Summen */
export function cardDetail(card: PeriodCard): CardDetail {
  const counted = cardShots(card.shots, true, card.sums)?.match ?? []
  const source = (metric: MetricDefinition, scoring: Scoring): ValueSource | null =>
    computeMetric(metric, counted) !== null
      ? "shots"
      : (sumsResult(card.sums, scoring)?.source ?? null)
  const placed = eligibleShots(MPI_DISTANCE, counted)
  const middle = centroid(
    placed.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  )
  const summary = card.sums?.center
  return {
    rings: source(RESULT_RINGS, "rings"),
    tenths: source(RESULT_DECIMAL, "decimal"),
    positions: selectShots(counted, { need: "position" }).length,
    times: selectShots(counted, { need: "time" }).length,
    center: middle
      ? { ...middle, n: placed.length, from: "shots" }
      : summary
        ? { xUm: summary.xUm, yUm: summary.yUm, n: summary.shots, from: "summary" }
        : null,
  }
}

/**
 * die Projektion einer Scheibe aus ihren Schüssen, für beide Wertungen und mit Probe (gefiltert wird beim Lesen). Die
 * Schüsse erst in Abgabefolge: Der Streukreis (Welzl) rechnet je nach Folge in der letzten Stelle anders, und die
 * gespeicherte Projektion soll nicht davon abhängen, in welcher Folge der Aufrufer sie liefert.
 */
export function cardProjection(input: PeriodCard): CardProjection {
  const card: PeriodCard = { ...input, shots: inShotOrder(input.shots) }
  const values: CardProjection["values"] = {}
  for (const metric of CARD_METRICS) {
    const [value] = cardValues([card], metric, metric.scoring ?? "decimal", {
      includeProbeOnly: true,
    })
    if (value)
      values[metric.key] = {
        value: value.value,
        n: value.n,
        ...(value.sd !== undefined ? { sd: value.sd } : {}),
      }
  }
  const counted = cardShots(card.shots, true, card.sums)?.match ?? []
  return {
    version: projectionVersion(),
    // eine Scheibe ohne Werte (wartet auf die Anlage) ist nicht nur Probe
    probeOnly: probeOnlyCard(card.shots, card.sums),
    suspicious: counted.some((shot) => (shot.flags ?? []).includes(FLAG_SUSPICIOUS)),
    printedShots: shotCountOf(card),
    values,
    records: {
      decimal: cardRecordCandidates(card, "decimal", true),
      rings: cardRecordCandidates(card, "rings", true),
    },
    detail: cardDetail(card),
  }
}

/** eine Scheibe mit Schüssen als Eingabe der Übersichten: ihre Merkmale und ihre Projektion (Tests) */
export function projectCard(card: PeriodCard): ProjectedCard {
  return {
    id: card.id,
    startedAtMs: card.startedAtMs,
    kind: card.kind,
    complete: card.complete,
    flags: card.flags ?? [],
    ...(card.official ? { official: card.official } : {}),
    projection: cardProjection(card),
  }
}

/** Raster der Lagen: 10 µm, weit unter einem Pixel der kleinen Scheiben */
const MARK_UM = 10

/** Lage eines Schusses für die kleinen Scheiben: x und y in 10 µm, der Ring; ohne Wert null */
export type CardMark = readonly [x: number, y: number, ring: number | null]

/** was eine kleine Scheibe von einem Schuss zeichnet */
export interface MarkShot {
  xUm: number
  yUm: number
  ring: number | null
}

/**
 * Die Lagen einer Scheibe für die kleinen Scheiben der Übersichten: die Schüsse wie am Ausdruck (`asOnPrintout`, bei
 * nur Probe die Probe), in Abgabefolge, was auf der Scheibe steht (`isDrawn`: mit Lage, ohne verdächtige, SF-15). Gespeichert neben der Projektion und nur für die gezeigten Scheiben gelesen;
 * rund 0,6 KB bei 40 Schuss statt aller Angaben jedes Schusses.
 */
export function cardMarks(shots: readonly MetricShot[]): CardMark[] {
  return inShotOrder(asOnPrintout(shots))
    .filter(isDrawn)
    .map((shot): CardMark => [
      Math.round((shot.xUm as number) / MARK_UM) || 0,
      Math.round((shot.yUm as number) / MARK_UM) || 0,
      shot.ring ?? null,
    ])
}

/** die Lagen zurück in µm, wie `MiniTarget` sie zeichnet */
export function markShots(marks: readonly CardMark[]): MarkShot[] {
  return marks.map(([x, y, ring]) => ({ xUm: x * MARK_UM, yUm: y * MARK_UM, ring }))
}

/** wie `trainingVolume`, aus den Projektionen: Schüsse wie am Ausdruck sind `printedShots` */
export function projectedVolume(
  cards: readonly ProjectedCard[],
  bucketOf: (atMs: number) => string,
  dayOf: (atMs: number) => string
): VolumeBucket[] {
  const buckets = new Map<string, { shots: number; cards: number; days: Set<string> }>()
  for (const card of byStart(cards)) {
    const key = bucketOf(card.startedAtMs)
    const bucket = buckets.get(key) ?? { shots: 0, cards: 0, days: new Set<string>() }
    bucket.shots += card.projection.printedShots
    bucket.cards += 1
    bucket.days.add(dayOf(card.startedAtMs))
    buckets.set(key, bucket)
  }
  return [...buckets].map(([key, b]) => ({
    key,
    shots: b.shots,
    cards: b.cards,
    days: b.days.size,
  }))
}

/**
 * Ø je Schuss über alle Schüsse mehrerer Scheiben zusammen, nicht das Mittel der Mittel: wie `computeMetric` mit dem
 * Ø je Schuss über ihre Schüsse wie am Ausdruck (nur Probe zählt, Einschießen nicht), gerechnet wie jeder Wert eines
 * Zeitraums (`pooledValue`, auf dem Raster der Wertung). null ohne Schuss mit Wert.
 */
export function pooledMean(cards: readonly ProjectedCard[], scoring: Scoring): number | null {
  const metric = inScoring(metricByKey("result.decimalMean") as MetricDefinition, scoring)
  return pooledValue(projectedValues(cards, metric, scoring), metric)
}

/**
 * wie `cardValues` mit `includeProbeOnly` (die Projektion rechnet nur Probe wie Wertung), aus den Projektionen;
 * Einschießen (`warmup`) nur mit `includeWarmup`
 */
export function projectedValues(
  cards: readonly ProjectedCard[],
  metric: Readonly<MetricDefinition>,
  scoring: Scoring,
  options: { includeWarmup?: boolean } = {}
): CardValue[] {
  if (!metric.scopes.includes("card"))
    throw new RangeError(`${metric.key}: keine Kennzahl der Ebene Scheibe, nicht in der Projektion`)
  const key = inScoring(metric, scoring).key
  return byStart(cards).flatMap((card) => {
    if (card.warmup && !options.includeWarmup) return []
    const entry = card.projection.values[key]
    if (!entry) return []
    const value: CardValue = { id: card.id, atMs: card.startedAtMs, value: entry.value, n: entry.n }
    if (entry.sd !== undefined) value.sd = entry.sd
    return [value]
  })
}

/** zählt die Scheibe für Rekorde (wie `recordEligible`)? */
export function projectedEligible(card: ProjectedCard): boolean {
  const excluding: readonly string[] = RECORD_EXCLUDING_FLAGS
  return (
    card.complete &&
    !card.flags.some((flag) => excluding.includes(flag)) &&
    !card.projection.suspicious
  )
}

/**
 * zählt eine Scheibe, die für Rekorde zählt, unter den Filtern der Seite (Art, Einschießen)? Eine Regel für
 * `projectedRecords` und jede andere Eingabe aus gespeicherten Kandidaten
 */
export function recordsInView(
  card: { kind: PeriodCard["kind"]; warmup?: boolean },
  options: { kind?: PeriodCard["kind"]; includeWarmup?: boolean }
): boolean {
  if (options.kind !== undefined && card.kind !== options.kind) return false
  return !card.warmup || Boolean(options.includeWarmup)
}

/** wie `periodRecords` mit `includeProbeOnly`, aus den Projektionen; Einschießen nur mit `includeWarmup` */
export function projectedRecords(
  cards: readonly ProjectedCard[],
  scoring: Scoring,
  options: { kind?: PeriodCard["kind"]; includeWarmup?: boolean } = {}
): PeriodRecords {
  return combineRecords(
    byStart(cards).flatMap((card) => {
      if (!projectedEligible(card)) return []
      if (!recordsInView(card, options)) return []
      const candidates = card.projection.records[scoring]
      return candidates ? [{ id: card.id, atMs: card.startedAtMs, candidates }] : []
    })
  )
}
