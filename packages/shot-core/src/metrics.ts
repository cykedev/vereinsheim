// Kennzahlen-Registry: Jede Kennzahl ist eine reine, versionierte Funktion mit Einheit, Richtung und
// Regeln dafür, welche Schüsse zählen. Daraus entstehen später ohne weiteren Code die Kachel in der
// Session, die Spalte im Serienvergleich, der Verlauf und der Vergleich (vault/spiegel/spiegel-metrics.md).
//
// Regeln aus dem Sonderfall-Katalog:
// - Ergebnis-Kennzahlen gelten nur für Wertungsschüsse, Lage und Tempo auch für die Probe (SF-01).
//   Welche Schüsse gemeint sind (Wertung, eine Serie, ein Probe-Block), wählt der Aufrufer.
// - Unter der Mindestzahl gibt es keinen Wert statt 0 (SF-61).
// - Fehlt einem Schuss die nötige Angabe, fällt er weg. Summen und Zählungen geben dann keinen Wert,
//   denn eine Summe über einen Teil der Schüsse ist kein Ergebnis (`onMissing`).
// - Fehlschüsse lassen nur robuste Maße weg (SF-14). Verdächtige Schüsse (Platzhalter, Handeintrag)
//   zählen nur mit ihrem amtlichen Wert, nie mit Lage, Abstand oder Zeit (SF-15). Schüsse über der
//   Soll-Zahl zählen mit Wert 0 und Zeit, nie mit Lage oder Abstand (SF-08).
// - `nSensitive` kennzeichnet Maße, die von der Schusszahl abhängen: Vergleiche nur bei gleichem n
//   (SF-60); das n liefert `eligibleShots`. Auch R50 fällt bei kleinem n leicht zu klein aus (bei
//   10 Schuss etwa 4 %); für Verläufe über verschiedene Schusszahlen taugt `group.sigma`.
// - Die Reihenfolge ist die Abgabefolge `seq`, nicht die Uhr (SF-30); eine Probe zwischen zwei
//   Wertungsschüssen ist in einer Auswahl nur der Wertung keine Lücke (SF-04).
//
// Wertung: Jede wertbasierte Kennzahl gibt es in ganzen Ringen und in Zehnteln (`scoring` und
// `counterpart`); `inScoring` wählt die passende, damit sich überall umschalten lässt. Ganze Ringe
// brauchen nur den Ring, Zehntel den Zehntelwert: Fehlen die Zehntel, bleibt die Ringwertung (SF-18).
//
// Ändert sich eine Formel, steigt ihre Version, und gespeicherte Werte werden neu berechnet.

import {
  centroid,
  distancesTo,
  r50,
  smallestEnclosingCircle,
  standardDeviation,
  type Point,
} from "./geometry"
import { teilerFromDistanceUm } from "./scoring"
import { c4, iqr } from "./stats"
import { gapsOf, pauseRule, tempo, type PauseRule } from "./time"

export type ShotKind = "match" | "probe"
export type MetricUnit = "Ringe" | "Teiler" | "mm" | "s" | "Schuss" | "%"
export type MetricScope = "series" | "card"
export type MetricNeed = "ring" | "decimal" | "position" | "distance" | "time" | "innerTen"
export type Scoring = "rings" | "decimal"

/** Fehlschuss (Nuller, Treffer weit außen): robuste Maße lassen ihn weg (SF-14) */
export const FLAG_MISS = "fehlschuss"
/** Verdächtiger Schuss (Platzhalter, Handeintrag): nur sein amtlicher Wert zählt (SF-15) */
export const FLAG_SUSPICIOUS = "verdaechtig"
/**
 * Schuss über der Soll-Zahl (SF-08): Meyton speichert ihn mit echter Lage, aber Wert 0 und ohne Abstand. Er zählt
 * mit seinem amtlichen Wert 0 und seiner Zeit, nicht in Lage und Abstand (sonst zöge er Schwerpunkt und Streuung).
 */
export const FLAG_OVER_TARGET = "ueber-soll"

/**
 * Jede Kennung, die an einer Scheibe stehen kann (`Card.flags`), an einer Stelle. Wer eine Kennung schreibt oder
 * benennt, nimmt `CardFlag`: Eine neue ohne Eintrag hier scheitert an `tsc`, ebenso eine ohne Namen (`FLAG_NAMES` in
 * `shot-ui`).
 */
export const CARD_FLAGS = [
  "unvollstaendig",
  "ausgenommen",
  "nur-probe",
  "leer",
  "ueber-soll",
  "korrigiert",
  "uhr-abweichung",
  "neu-gewertet",
  "als-wertung-gezaehlt",
  "disziplin-unbekannt",
  "scheibe-passt-nicht",
] as const
export type CardFlag = (typeof CARD_FLAGS)[number]

export interface MetricShot {
  /**
   * Abgabefolge (SF-30), eindeutig über die ganze Scheibe (Probe und Wertung in einer Folge). Fehlt
   * sie, ordnet die Zeit, sonst die Liste; ohne sie lässt sich ein fehlender Schuss nicht erkennen.
   */
  seq?: number | null
  /** Lage in µm; null bei Ergebnissen nur aus dem PDF */
  xUm: number | null
  yUm: number | null
  /** Wert in Zehnteln (94 = 9,4), amtlich oder neu gewertet; null unbekannt */
  decimalTenths: number | null
  ring: number | null
  /** null unbekannt, etwa eingetragen ohne Lage */
  innerTen: boolean | null
  /** Abstand zur Mitte in µm, etwa aus dem Teiler; sonst aus der Lage */
  distanceUm?: number | null
  /** Abgabezeit in ms (UTC); null unbekannt */
  firedAtMs: number | null
  kind: ShotKind
  series: number | null
  /** Merkmale; für Kennzahlen zählen FLAG_MISS, FLAG_SUSPICIOUS und FLAG_OVER_TARGET */
  flags?: readonly string[]
}

/** Serien-Summe ohne Einzelschüsse oder neben ihnen: Schusszahl, Summe in ganzen Ringen und in Zehnteln (984 = 98,4) */
export interface SeriesSum {
  series: number
  shots: number
  rings: number | null
  decimalTenths: number | null
}

/**
 * Angaben einer Scheibe ohne oder neben Einzelschüssen ([[adr-033]]): Serien-Summen, das Gesamtergebnis und die
 * Trefferlage als Summe (Mitte der Schüsse in µm), jede mit ihrer gespeicherten Schusszahl
 */
export interface CardSums {
  series: readonly SeriesSum[]
  total: { shots: number; rings: number | null; decimalTenths: number | null } | null
  center: { xUm: number; yUm: number; shots: number } | null
}

/** woher ein Ergebnis aus Summen kommt */
export type SumSource = "series" | "total"

/** Schusszahl der Summen: die der Serien, wenn es welche gibt, sonst die des Gesamtergebnisses */
export function sumsShots(sums?: CardSums): number {
  if (!sums) return 0
  if (sums.series.length) return sums.series.reduce((total, s) => total + s.shots, 0)
  return sums.total?.shots ?? 0
}

/**
 * Ergebnis aus Summen in Zehnteln, damit beide Wertungen eine Rechnung haben: die Serien, wenn jede den Wert der
 * Wertung trägt, sonst das Gesamtergebnis mit diesem Wert, sonst null
 */
export function sumsResult(
  sums: CardSums | undefined,
  scoring: Scoring
): { tenths: number; shots: number; source: SumSource } | null {
  if (!sums) return null
  const tenthsOf = (sum: { rings: number | null; decimalTenths: number | null }) =>
    scoring === "rings" ? (sum.rings === null ? null : sum.rings * 10) : sum.decimalTenths
  const series = sums.series.map(tenthsOf)
  if (series.length && series.every((t) => t !== null)) {
    return {
      tenths: series.reduce((total: number, t) => total + (t as number), 0),
      shots: sumsShots(sums),
      source: "series",
    }
  }
  const total = sums.total === null ? null : tenthsOf(sums.total)
  return sums.total && total !== null
    ? { tenths: total, shots: sums.total.shots, source: "total" }
    : null
}

export interface MetricDefinition {
  key: string
  /** Katalog-ID aus vault/spiegel/spiegel-statistics.md, etwa "P5"; die Hilfe erklärt sie (shot-help) */
  catalogId: string
  label: string
  unit: MetricUnit
  decimals: number
  scopes: readonly MetricScope[]
  better: "higher" | "lower" | "none"
  version: number
  /** welche Schüsse zählen; Ergebnis-Kennzahlen nur "match" (SF-01) */
  appliesTo: readonly ShotKind[]
  /** darunter kein Wert, nicht 0 (SF-61) */
  minShots: number
  /** hängt von der Schusszahl ab: Vergleiche nur bei gleichem n (SF-60); ein Hinweis für Aufrufer */
  nSensitive: boolean
  /** robustes Maß: lässt Fehlschüsse weg (SF-14) */
  excludeMisses: boolean
  /** welche Angabe die Schüsse brauchen */
  needs: MetricNeed
  /** fehlt einem zählenden Schuss die Angabe: ihn weglassen oder gar kein Wert (Summen, Zählungen) */
  onMissing: "drop" | "null"
  /** nur wertbasierte Kennzahlen: die Wertung und das Gegenstück in der anderen Wertung */
  scoring?: Scoring
  counterpart?: string
  /**
   * Wie der Wert über die Schüsse vieler Scheiben zusammengeht ([[adr-034]]): `mean` als Mittel über alle Schüsse
   * (dann sagt `perShot`, was ein Schuss beiträgt), `spreadAxis` als Streuung einer Richtung über ν = n − 1, `spreadRadial`
   * als Rayleigh-σ über ν = 2(n − 1). Ohne Angabe bleibt der Wert eine Zahl je Scheibe.
   */
  pooling?: "mean" | "spreadAxis" | "spreadRadial"
  /** nur bei `pooling: "mean"`: der Beitrag eines gezählten Schusses; `compute` ist ihr Mittel */
  perShot?: (shot: MetricShot) => number
  /**
   * Die Formel. Sie rechnet nur über `computeMetric` richtig: Erst das filtert die Schüsse und
   * garantiert die Angaben, die `needs` verlangt. `context`: Karte und Arten der Auswahl, für Abstände
   * (SF-04).
   */
  compute: (shots: readonly MetricShot[], context: ShotContext) => number | null
  /**
   * Wert aus Angaben ohne Einzelschüsse (`CardSums`), nur wenn die Schüsse keinen geben; nur Kennzahlen der Ebene
   * Scheibe, nie für Streuung ([[adr-033]]). `n` ist die gespeicherte Schusszahl der Angabe.
   */
  summary?: (sums: CardSums) => { value: number; n: number } | null
}

const KEY = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z0-9]*)+$/
/** Form einer Katalog-ID ([[spiegel-statistics]]): Buchstabe der Gruppe, dann die Nummer */
export const CATALOG_ID = /^[EPLVZISTRCKWQ]\d+$/

export function defineMetric(def: MetricDefinition): Readonly<MetricDefinition> {
  if (!KEY.test(def.key)) {
    throw new RangeError(`"${def.key}": Schlüssel wie "group.r50"`)
  }
  if (!CATALOG_ID.test(def.catalogId)) {
    throw new RangeError(`${def.key}: Katalog-ID wie "P5", nicht "${def.catalogId}"`)
  }
  if (!Number.isInteger(def.version) || def.version < 1) {
    throw new RangeError(`${def.key}: Version muss eine ganze Zahl ab 1 sein`)
  }
  if (!Number.isInteger(def.minShots) || def.minShots < 1) {
    throw new RangeError(`${def.key}: Mindestzahl muss ab 1 sein`)
  }
  if (!Number.isInteger(def.decimals) || def.decimals < 0 || def.decimals > 3) {
    throw new RangeError(`${def.key}: Nachkommastellen 0 bis 3`)
  }
  if (def.appliesTo.length === 0 || def.scopes.length === 0) {
    throw new RangeError(`${def.key}: appliesTo und scopes dürfen nicht leer sein`)
  }
  if (
    (def.scoring === undefined) !== (def.counterpart === undefined) ||
    def.counterpart === def.key
  ) {
    throw new RangeError(`${def.key}: scoring und counterpart nur zusammen, mit fremdem Schlüssel`)
  }
  if ((def.pooling === "mean") !== (def.perShot !== undefined)) {
    throw new RangeError(`${def.key}: perShot genau dann, wenn pooling "mean" ist`)
  }
  if (def.summary && !def.scopes.includes("card")) {
    throw new RangeError(`${def.key}: summary nur für Kennzahlen der Ebene Scheibe`)
  }
  if (def.summary && (def.pooling === "spreadAxis" || def.pooling === "spreadRadial")) {
    throw new RangeError(`${def.key}: summary nie für eine Streuung`)
  }
  return Object.freeze({
    ...def,
    scopes: Object.freeze([...def.scopes]),
    appliesTo: Object.freeze([...def.appliesTo]),
  })
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value)

const hasPosition = (shot: MetricShot) => finite(shot.xUm) && finite(shot.yUm)
/**
 * Steht der Schuss auf der Scheibe? Mit Lage, außer verdächtig (SF-15: Platzhalter oder Handeintrag). Ein Schuss über
 * der Soll-Zahl (SF-08) steht da, wo er liegt, zählt aber in keiner Kennzahl der Lage.
 */
export const isDrawn = (shot: Pick<MetricShot, "xUm" | "yUm" | "flags">) =>
  finite(shot.xUm) && finite(shot.yUm) && !(shot.flags ?? []).includes(FLAG_SUSPICIOUS)
const hasDistance = (shot: MetricShot) => finite(shot.distanceUm) && shot.distanceUm >= 0

/** Gültig sind endliche Zahlen, ein Abstand nicht negativ; alles andere gilt als fehlend. */
function satisfies(shot: MetricShot, need: MetricNeed): boolean {
  switch (need) {
    case "ring":
      return finite(shot.ring)
    case "decimal":
      return finite(shot.decimalTenths)
    case "position":
      return hasPosition(shot)
    case "distance":
      return hasDistance(shot) || hasPosition(shot)
    case "time":
      return finite(shot.firedAtMs)
    case "innerTen":
      // ein Innenzehner ist ein Zehner: ohne Ring ist auch er unbekannt
      return typeof shot.innerTen === "boolean" && finite(shot.ring)
  }
}

/** Zählt der Schuss für die Kennzahl, ob ihm eine Angabe fehlt oder nicht? */
export interface ShotFilter {
  /** welche Schüsse; ohne Angabe Probe und Wertung */
  kinds?: readonly ShotKind[]
  /** welche Angabe gültig sein muss */
  need: MetricNeed
  /** Fehlschüsse weglassen (robuste Maße, SF-14) */
  excludeMisses?: boolean
}

/** Zählt der Schuss für die Auswahl, ob ihm eine Angabe fehlt oder nicht? */
function allowed(shot: MetricShot, filter: ShotFilter): boolean {
  if (!(filter.kinds ?? BOTH).includes(shot.kind)) return false
  const flags = shot.flags ?? []
  const valueOnly =
    filter.need === "ring" || filter.need === "decimal" || filter.need === "innerTen"
  if (!valueOnly && flags.includes(FLAG_SUSPICIOUS)) return false
  const placed = filter.need === "position" || filter.need === "distance"
  if (placed && flags.includes(FLAG_OVER_TARGET)) return false
  return !(filter.excludeMisses && flags.includes(FLAG_MISS))
}

const counts = (metric: MetricDefinition, shot: MetricShot) =>
  allowed(shot, {
    kinds: metric.appliesTo,
    need: metric.needs,
    excludeMisses: metric.excludeMisses,
  })

/**
 * Schüsse nach denselben Regeln wie die Registry: Art, verdächtige nur mit ihrem Wert (SF-15), über der Soll-Zahl
 * ohne Lage und Abstand (SF-08), Fehlschüsse auf Wunsch weg (SF-14), gültige Angabe. Für Auswertungen, die keine Kennzahl sind.
 */
export function selectShots(shots: readonly MetricShot[], filter: ShotFilter): MetricShot[] {
  return shots.filter((shot) => allowed(shot, filter) && satisfies(shot, filter.need))
}

/** Zählende Schüsse und die davon, die auch die nötige Angabe haben */
function partition(metric: MetricDefinition, shots: readonly MetricShot[]) {
  const counting = shots.filter((shot) => counts(metric, shot))
  const eligible = counting.filter((shot) => satisfies(shot, metric.needs))
  return { counting, eligible }
}

/** Die Schüsse, über die eine Kennzahl rechnet; ihre Zahl ist das n für Vergleiche (SF-60). */
export function eligibleShots(
  metric: MetricDefinition,
  shots: readonly MetricShot[]
): MetricShot[] {
  return partition(metric, shots).eligible
}

/**
 * Wert der Kennzahl für die gewählten Schüsse. Die Auswahl (Wertung, eine Serie, ein Probe-Block)
 * trifft der Aufrufer; `appliesTo` schließt nur aus, was für die Kennzahl nie zählt. `card`: die ganze
 * Karte, aus der `shots` stammen, in derselben Form (bei nur Probe nach `probeOnlyAsMatch`); nur für
 * Abstände (SF-04).
 */
export function computeMetric(
  metric: MetricDefinition,
  shots: readonly MetricShot[],
  card: readonly MetricShot[] = shots
): number | null {
  const { counting, eligible } = partition(metric, shots)
  if (metric.onMissing === "null" && eligible.length < counting.length) return null
  if (eligible.length < metric.minShots) return null
  return metric.compute(eligible, contextOf(shots, card))
}

/**
 * Wert einer Kennzahl aus den Angaben ohne Einzelschüsse (`summary`): ohne sie oder ohne Angaben null, ebenso unter der
 * Mindestzahl der Kennzahl
 */
export function summaryValue(
  metric: Readonly<MetricDefinition>,
  sums?: CardSums
): { value: number; n: number } | null {
  if (!metric.summary || !sums) return null
  const result = metric.summary(sums)
  return result && result.n >= metric.minShots ? result : null
}

/**
 * In Abgabefolge: nach `seq`, wenn alle eine haben (SF-30); sonst nach der Zeit, wenn alle eine
 * haben; sonst wie gegeben. Gleiche Werte behalten die Reihenfolge der Liste.
 */
export function inShotOrder<T extends Pick<MetricShot, "seq" | "firedAtMs">>(
  shots: readonly T[]
): T[] {
  if (shots.every((shot) => finite(shot.seq))) {
    return [...shots].sort((a, b) => (a.seq as number) - (b.seq as number))
  }
  if (shots.every((shot) => finite(shot.firedAtMs))) {
    return [...shots].sort((a, b) => (a.firedAtMs as number) - (b.firedAtMs as number))
  }
  return [...shots]
}

/**
 * Nummer jedes Schusses in der Abgabefolge seiner Art, ab 1 (Wertung 1, 2, …; Probe 1, 2, …), über
 * alle gegebenen Schüsse und unabhängig davon, welche Angaben ihm fehlen: Schuss 8 bleibt Schuss 8,
 * auch wenn Schuss 3 ein Platzhalter ist oder keinen Wert hat (SF-15, SF-30). Alle Nummern der
 * Auswertungen kommen hierher.
 */
export function shotNumbers(shots: readonly MetricShot[]): Map<MetricShot, number> {
  const numbers = new Map<MetricShot, number>()
  const next: Record<ShotKind, number> = { match: 0, probe: 0 }
  for (const shot of inShotOrder(shots)) numbers.set(shot, ++next[shot.kind])
  return numbers
}

/** Schüsse je Serie, wenn eine Karte nur Probe hat */
const PROBE_SERIES_SIZE = 10

/**
 * Eine Karte nur mit Probe als Wertung (SF-01): jeder Schuss wird
 * Wertungsschuss, in Serien zu zehn nach der Abgabefolge (`inShotOrder`); Reihenfolge der Liste und alle
 * übrigen Angaben bleiben. Hat die Karte einen Wertungsschuss oder keinen Schuss, bleibt sie, wie sie ist.
 * Die eine Regel für die Seite einer Scheibe (shot-ui `probeOnlyAsMatch`) und für Zeiträume (`analysis`).
 */
export function probeOnlyAsMatch<T extends MetricShot>(shots: readonly T[]): readonly T[] {
  if (!shots.length || shots.some((shot) => shot.kind !== "probe")) return shots
  const position = new Map(inShotOrder(shots).map((shot, i) => [shot, i]))
  return shots.map((shot) => ({
    ...shot,
    kind: "match" as const,
    series: Math.floor((position.get(shot) as number) / PROBE_SERIES_SIZE) + 1,
  }))
}

/**
 * Eine Scheibe wie am Ausdruck (ADR-027, Leitregel 3 in `spiegel-edge-cases`): Meyton löscht die Probe mit dem
 * ersten Wertungsschuss, also hat eine Scheibe mit Wertung nur die Wertungsschüsse; eine Probe zwischen Wertung (SF-04)
 * fällt ebenso weg. Eine Karte nur mit Probe zählt wie Wertung (`probeOnlyAsMatch`). Reihenfolge der Liste und alle Angaben
 * bleiben; ohne Probe neben Wertung ist es dieselbe Liste. Die eine Regel für die Seite einer Scheibe und für Zeiträume.
 */
export function asOnPrintout<T extends MetricShot>(shots: readonly T[]): readonly T[] {
  if (!shots.some((shot) => shot.kind === "match")) return probeOnlyAsMatch(shots)
  if (shots.every((shot) => shot.kind === "match")) return shots
  return shots.filter((shot) => shot.kind === "match")
}

// ---------------------------------------------------------------------------------------------
// Hilfen für die Definitionen. Die Filter in computeMetric garantieren die nötigen Angaben.

const points = (shots: readonly MetricShot[]): Point[] =>
  shots.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
const toMm = (um: number | null) => (um === null ? null : um / 1000)
const sumTenths = (shots: readonly MetricShot[]) =>
  shots.reduce((sum, shot) => sum + (shot.decimalTenths as number), 0)
const sumRings = (shots: readonly MetricShot[]) =>
  shots.reduce((sum, shot) => sum + (shot.ring as number), 0)
/** Abstand zur Mitte in µm: der gemessene, wenn gültig, sonst aus der Lage */
export const shotDistanceUm = (shot: MetricShot) =>
  hasDistance(shot)
    ? (shot.distanceUm as number)
    : Math.hypot(shot.xUm as number, shot.yUm as number)
const seconds = (ms: number | null) => (ms === null ? null : ms / 1000)
export interface ShotStep {
  shot: MetricShot
  /** davor fehlt ein Schuss: `seq` springt (SF-30) */
  gapBefore: boolean
}

/**
 * Woher eine Auswahl stammt: die ganze Karte und die Arten der Auswahl (SF-04). Die Karte in derselben Form
 * wie die Auswahl, bei nur Probe also nach `probeOnlyAsMatch`.
 */
export interface ShotContext {
  card: readonly MetricShot[]
  kinds: readonly ShotKind[]
}

/**
 * Kontext einer Auswahl aus einer Karte. Die Arten kommen aus der Auswahl selbst, vor jedem Filter nach
 * Angaben: Eine Probe ohne Zeit in „alle mit Probe“ bleibt Teil der Auswahl.
 */
export function contextOf(
  selection: readonly MetricShot[],
  card: readonly MetricShot[]
): ShotContext {
  return { card, kinds: [...new Set(selection.map((shot) => shot.kind))] }
}

/** Schüsse in Abgabefolge mit der Markierung, wo ein Schuss fehlt; Grundlage aller Zeit-Auswertungen */
export function shotSteps(shots: readonly MetricShot[], context?: ShotContext): ShotStep[] {
  return stepsInOrder(inShotOrder(shots), context)
}

/**
 * Wie `shotSteps`, für Schüsse, die schon in Abgabefolge stehen, etwa eine Auswahl aus `inShotOrder`
 * aller Schüsse einer Karte; ordnet nicht neu. So folgen die Auswertungen derselben Reihenfolge wie
 * `shotNumbers`, auch wenn einem Schuss Abgabefolge und Zeit fehlen und die Karte nur nach der Liste
 * geordnet werden kann.
 *
 * Mit `context` ist ein Sprung in `seq`, den auf der Karte nur Probeschüsse füllen, in einer Auswahl ohne
 * Probe keine Lücke (SF-04: eine Probe zwischen zwei Wertungsschüssen). Fehlt der Karte eine Nummer oder
 * liegt dazwischen ein Schuss einer Art der Auswahl (ohne Zeit, Platzhalter), bleibt es eine. Durchlässig
 * ist nur die Probe: In einer Auswahl der Probe bleiben Wertungsschüsse dazwischen eine Lücke, sonst würde
 * aus der Wertung eine Pause der Probe. Ohne `context` ist jeder Sprung eine Lücke.
 */
export function stepsInOrder(ordered: readonly MetricShot[], context?: ShotContext): ShotStep[] {
  const withSeq = ordered.every((shot) => finite(shot.seq))
  // Nummern, die keine Lücke aufreißen: Probeschüsse der Karte, wenn die Auswahl keine Probe hat
  const sighters = new Set(
    context && !context.kinds.includes("probe")
      ? context.card
          .filter((shot) => shot.kind === "probe" && finite(shot.seq))
          .map((shot) => shot.seq as number)
      : []
  )
  const filled = (from: number, to: number) => {
    if (to - from - 1 > sighters.size) return false
    for (let seq = from + 1; seq < to; seq++) if (!sighters.has(seq)) return false
    return true
  }
  return ordered.map((shot, i) => {
    const from = ordered[i - 1]?.seq as number
    const to = shot.seq as number
    return { shot, gapBefore: withSeq && i > 0 && to - from > 1 && !filled(from, to) }
  })
}

function timesOf(steps: readonly ShotStep[]): (number | null)[] {
  const times: (number | null)[] = []
  for (const step of steps) {
    if (step.gapBefore) times.push(null)
    times.push(finite(step.shot.firedAtMs) ? step.shot.firedAtMs : null)
  }
  return times
}

/** Zeiten in Abgabefolge für `tempo()`: `null` dort, wo ein Schuss fehlt oder keine gültige Zeit hat */
export function timesWithGaps(
  shots: readonly MetricShot[],
  context?: ShotContext
): (number | null)[] {
  return timesOf(shotSteps(shots, context))
}

/** Wie `timesWithGaps`, für Schüsse, die schon in Abgabefolge stehen (siehe `stepsInOrder`) */
export function timesInOrder(
  ordered: readonly MetricShot[],
  context?: ShotContext
): (number | null)[] {
  return timesOf(stepsInOrder(ordered, context))
}

export interface ShotInterval {
  shot: MetricShot
  /** Abstand zum vorigen Schuss in ms; null beim ersten, nach einer Lücke, ohne Zeit und bei einem Rücksprung der Uhr */
  intervalMs: number | null
}

/** Abstand jedes Schusses zum vorigen, für Schüsse, die schon in Abgabefolge stehen (siehe `stepsInOrder`; SF-30) */
export function intervalsInOrder(
  ordered: readonly MetricShot[],
  context?: ShotContext
): ShotInterval[] {
  const steps = stepsInOrder(ordered, context)
  return steps.map((step, i) => {
    const now = step.shot.firedAtMs
    const then = steps[i - 1]?.shot.firedAtMs
    const gap =
      !step.gapBefore && Number.isFinite(now) && Number.isFinite(then)
        ? (now as number) - (then as number)
        : Number.NaN
    return { shot: step.shot, intervalMs: gap >= 0 ? gap : null }
  })
}

/**
 * die Regel für Pausen aus dem Takt der ganzen Karte, in den Arten der Auswahl (`time.ts`): Eine Serie sieht so
 * dieselben Pausen wie die Scheibe. Es zählen nur Schüsse mit gültiger Zeit, wie in jeder Zeit-Auswertung (SF-15). Hat
 * die Karte keinen Schuss dieser Arten (nur Probe, als Wertung gezeigt), gilt die Auswahl selbst; ohne Karte ebenso
 */
export function pauseRuleOf(shots: readonly MetricShot[], context?: ShotContext): PauseRule {
  const own = context ? selectShots(context.card, { kinds: context.kinds, need: "time" }) : []
  if (own.length) return pauseRule(gapsOf(timesWithGaps(own, context)))
  return pauseRule(gapsOf(timesWithGaps(selectShots(shots, { need: "time" }))))
}

/** die Schwelle für Pausen der Karte (`pauseRuleOf`) */
export const pauseThresholdOf = (shots: readonly MetricShot[], context?: ShotContext) =>
  pauseRuleOf(shots, context).thresholdMs

const pace = (shots: readonly MetricShot[], context?: ShotContext) =>
  tempo(timesWithGaps(shots, context), pauseThresholdOf(shots, context))

const BOTH: readonly ShotKind[] = ["match", "probe"]
const MATCH_ONLY: readonly ShotKind[] = ["match"]
const SERIES_AND_CARD: readonly MetricScope[] = ["series", "card"]

export const METRICS: readonly Readonly<MetricDefinition>[] = Object.freeze([
  defineMetric({
    key: "result.rings",
    catalogId: "E1",
    label: "Ergebnis",
    unit: "Ringe",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "ring",
    onMissing: "null",
    scoring: "rings",
    counterpart: "result.decimal",
    summary: (sums) => {
      const r = sumsResult(sums, "rings")
      return r && { value: r.tenths / 10, n: r.shots }
    },
    compute: sumRings,
  }),
  defineMetric({
    key: "result.decimal",
    catalogId: "E1",
    label: "Ergebnis",
    unit: "Ringe",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "decimal",
    onMissing: "null",
    scoring: "decimal",
    counterpart: "result.rings",
    summary: (sums) => {
      const r = sumsResult(sums, "decimal")
      return r && { value: r.tenths / 10, n: r.shots }
    },
    compute: (shots) => sumTenths(shots) / 10,
  }),
  defineMetric({
    key: "result.decimalMean",
    pooling: "mean",
    perShot: (shot) => (shot.decimalTenths as number) / 10,
    catalogId: "E2",
    label: "Ø je Schuss",
    unit: "Ringe",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: false,
    excludeMisses: false,
    needs: "decimal",
    onMissing: "drop",
    scoring: "decimal",
    counterpart: "result.ringsMean",
    summary: (sums) => {
      const r = sumsResult(sums, "decimal")
      return r && { value: r.tenths / 10 / r.shots, n: r.shots }
    },
    compute: (shots) => sumTenths(shots) / 10 / shots.length,
  }),
  defineMetric({
    key: "result.ringsMean",
    pooling: "mean",
    perShot: (shot) => shot.ring as number,
    catalogId: "E2",
    label: "Ø je Schuss",
    unit: "Ringe",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: false,
    excludeMisses: false,
    needs: "ring",
    onMissing: "drop",
    scoring: "rings",
    counterpart: "result.decimalMean",
    summary: (sums) => {
      const r = sumsResult(sums, "rings")
      return r && { value: r.tenths / 10 / r.shots, n: r.shots }
    },
    compute: (shots) => sumRings(shots) / shots.length,
  }),
  defineMetric({
    key: "result.tens",
    catalogId: "E4",
    label: "Zehner",
    unit: "Schuss",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "ring",
    onMissing: "null",
    compute: (shots) => shots.filter((shot) => (shot.ring as number) >= 10).length,
  }),
  defineMetric({
    key: "result.innerTens",
    catalogId: "E5",
    label: "Innenzehner",
    unit: "Schuss",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "higher",
    // 2: unbekannt ist kein Innenzehner, sondern kein Wert
    version: 2,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "innerTen",
    onMissing: "null",
    compute: (shots) => shots.filter((shot) => shot.innerTen === true).length,
  }),
  defineMetric({
    key: "result.tensRate",
    pooling: "mean",
    perShot: (shot) => ((shot.ring as number) >= 10 ? 100 : 0),
    catalogId: "E4",
    label: "Zehnerquote",
    unit: "%",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: false,
    excludeMisses: false,
    needs: "ring",
    onMissing: "drop",
    compute: (shots) =>
      (shots.filter((shot) => (shot.ring as number) >= 10).length / shots.length) * 100,
  }),
  defineMetric({
    key: "result.bestTeiler",
    catalogId: "E8",
    label: "bester Teiler",
    unit: "Teiler",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "distance",
    onMissing: "drop",
    compute: (shots) => teilerFromDistanceUm(Math.min(...shots.map(shotDistanceUm))),
  }),
  defineMetric({
    key: "group.mpiDistance",
    catalogId: "L2",
    label: "Schwerpunkt-Abstand",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 2,
    // Bei wenigen Schüssen streut der Schwerpunkt selbst: Der Abstand hängt von n ab.
    nSensitive: true,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    // die Trefferlage als Summe: nur Versatz und Richtung, nie Streuung
    summary: (sums) =>
      sums.center && {
        value: Math.hypot(sums.center.xUm, sums.center.yUm) / 1000,
        n: sums.center.shots,
      },
    compute: (shots) => {
      const center = centroid(points(shots))
      return center === null ? null : Math.hypot(center.xUm, center.yUm) / 1000
    },
  }),
  defineMetric({
    key: "group.enclosingDiameter",
    catalogId: "P1",
    label: "Streukreis",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: true,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => {
      const circle = smallestEnclosingCircle(points(shots))
      return circle === null ? null : (2 * circle.radiusUm) / 1000
    },
  }),
  defineMetric({
    key: "group.r50",
    catalogId: "P4",
    label: "R50",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 5,
    nSensitive: true,
    excludeMisses: true,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => toMm(r50(points(shots))),
  }),
  defineMetric({
    key: "group.sigma",
    pooling: "spreadRadial",
    catalogId: "P5",
    label: "Präzision σ",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 3,
    // Rayleigh-σ, erwartungstreu: σ̂ = √(Σr² / (2(n − 1))) / c4(2n − 1), kaum von n abhängig (Katalog P5).
    nSensitive: false,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => {
      const all = points(shots)
      const center = centroid(all) as Point
      const sumSquares = distancesTo(all, center).reduce((sum, r) => sum + r * r, 0)
      return Math.sqrt(sumSquares / (2 * (all.length - 1))) / c4(2 * all.length - 1) / 1000
    },
  }),
  defineMetric({
    key: "group.sdX",
    pooling: "spreadAxis",
    catalogId: "P6",
    label: "Streuung x",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => toMm(standardDeviation(shots.map((shot) => shot.xUm as number))),
  }),
  defineMetric({
    key: "group.sdY",
    pooling: "spreadAxis",
    catalogId: "P6",
    label: "Streuung y",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    // 2: ohne Schüsse über der Soll-Zahl (SF-08)
    version: 2,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => toMm(standardDeviation(shots.map((shot) => shot.yUm as number))),
  }),
  defineMetric({
    key: "time.intervalMedian",
    catalogId: "Z1",
    label: "Tempo (Median)",
    unit: "s",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "none",
    // 3: Pausen relativ zum Takt der Karte; 4: Pause über dem Doppelten statt dem 2,5-Fachen
    version: 4,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeMisses: false,
    needs: "time",
    onMissing: "drop",
    compute: (shots, context) => seconds(pace(shots, context).medianIntervalMs),
  }),
  defineMetric({
    key: "time.tempoSpread",
    catalogId: "Z2",
    label: "Tempo-Streuung",
    unit: "s",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    // konstanter ist nicht automatisch besser (Katalog Z2)
    better: "none",
    // 3: Pausen relativ zum Takt der Karte; 4: Pause über dem Doppelten statt dem 2,5-Fachen
    version: 4,
    appliesTo: BOTH,
    minShots: 4,
    nSensitive: false,
    excludeMisses: false,
    needs: "time",
    onMissing: "drop",
    compute: (shots, context) => {
      const intervals = pace(shots, context).intervalsMs
      return intervals.length >= 3 ? seconds(iqr(intervals)) : null
    },
  }),
  defineMetric({
    key: "time.duration",
    catalogId: "Z3",
    label: "Dauer",
    unit: "s",
    decimals: 0,
    scopes: ["card"],
    better: "none",
    version: 2,
    appliesTo: BOTH,
    minShots: 2,
    nSensitive: true,
    excludeMisses: false,
    needs: "time",
    onMissing: "drop",
    compute: (shots, context) => seconds(pace(shots, context).durationMs),
  }),
])

const BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]))

export function metricByKey(key: string): Readonly<MetricDefinition> | undefined {
  return BY_KEY.get(key)
}

/**
 * Die Kennzahl in der gewählten Wertung: ihr Gegenstück, wenn sie in der anderen rechnet. Kennzahlen
 * ohne Wertung (Lage, Tempo, Teiler, Zehner) bleiben, wie sie sind.
 */
export function inScoring(
  metric: Readonly<MetricDefinition>,
  scoring: Scoring
): Readonly<MetricDefinition> {
  if (metric.scoring === undefined || metric.scoring === scoring) return metric
  const other = metric.counterpart === undefined ? undefined : BY_KEY.get(metric.counterpart)
  if (!other)
    throw new Error(`${metric.key}: Gegenstück ${metric.counterpart} fehlt in der Registry`)
  return other
}
