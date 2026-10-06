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
//   zählen nur mit ihrem amtlichen Wert, nie mit Lage, Abstand oder Zeit (SF-15).
// - `nSensitive` kennzeichnet Maße, die von der Schusszahl abhängen: Vergleiche nur bei gleichem n
//   (SF-60); das n liefert `eligibleShots`.
// - Die Reihenfolge ist die Abgabefolge `seq`, nicht die Uhr (SF-30).
//
// Wertung: Jede wertbasierte Kennzahl gibt es in ganzen Ringen und in Zehnteln (`scoring` und
// `counterpart`); `inScoring` wählt die passende, damit sich überall umschalten lässt. Ganze Ringe
// brauchen nur den Ring, Zehntel den Zehntelwert: Fehlen die Zehntel, bleibt die Ringwertung (SF-18).
//
// Ändert sich eine Formel, steigt ihre Version, und gespeicherte Werte werden neu berechnet.

import {
  centroid,
  meanRadius,
  r50,
  smallestEnclosingCircle,
  standardDeviation,
  type Point,
} from "./geometry"
import { teilerFromDistanceUm } from "./scoring"
import { tempo } from "./time"

export type ShotKind = "match" | "probe"
export type MetricUnit = "Ringe" | "Teiler" | "mm" | "s" | "Schuss"
export type MetricScope = "series" | "card"
export type MetricNeed = "ring" | "decimal" | "position" | "distance" | "time"
export type Scoring = "rings" | "decimal"

/** Fehlschuss (Nuller, Treffer weit außen): robuste Maße lassen ihn weg (SF-14) */
export const FLAG_MISS = "fehlschuss"
/** Verdächtiger Schuss (Platzhalter, Handeintrag): nur sein amtlicher Wert zählt (SF-15) */
export const FLAG_SUSPICIOUS = "verdaechtig"

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
  innerTen: boolean
  /** Abstand zur Mitte in µm, etwa aus dem Teiler; sonst aus der Lage */
  distanceUm?: number | null
  /** Abgabezeit in ms (UTC); null unbekannt */
  firedAtMs: number | null
  kind: ShotKind
  series: number | null
  /** Merkmale; für Kennzahlen zählen FLAG_MISS und FLAG_SUSPICIOUS */
  flags?: readonly string[]
}

export interface MetricDefinition {
  key: string
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
   * Die Formel. Sie rechnet nur über `computeMetric` richtig: Erst das filtert die Schüsse und
   * garantiert die Angaben, die `needs` verlangt.
   */
  compute: (shots: readonly MetricShot[]) => number | null
}

const KEY = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z0-9]*)+$/

export function defineMetric(def: MetricDefinition): Readonly<MetricDefinition> {
  if (!KEY.test(def.key)) {
    throw new RangeError(`"${def.key}": Schlüssel wie "group.r50"`)
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
  return Object.freeze({
    ...def,
    scopes: Object.freeze([...def.scopes]),
    appliesTo: Object.freeze([...def.appliesTo]),
  })
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value)

const hasPosition = (shot: MetricShot) => finite(shot.xUm) && finite(shot.yUm)
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
  }
}

/** Zählt der Schuss für die Kennzahl, ob ihm eine Angabe fehlt oder nicht? */
function counts(metric: MetricDefinition, shot: MetricShot): boolean {
  if (!metric.appliesTo.includes(shot.kind)) return false
  const flags = shot.flags ?? []
  const valueOnly = metric.needs === "ring" || metric.needs === "decimal"
  if (!valueOnly && flags.includes(FLAG_SUSPICIOUS)) return false
  return !(metric.excludeMisses && flags.includes(FLAG_MISS))
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
 * trifft der Aufrufer; `appliesTo` schließt nur aus, was für die Kennzahl nie zählt.
 */
export function computeMetric(
  metric: MetricDefinition,
  shots: readonly MetricShot[]
): number | null {
  const { counting, eligible } = partition(metric, shots)
  if (metric.onMissing === "null" && eligible.length < counting.length) return null
  if (eligible.length < metric.minShots) return null
  return metric.compute(eligible)
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

// ---------------------------------------------------------------------------------------------
// Hilfen für die Definitionen. Die Filter in computeMetric garantieren die nötigen Angaben.

const points = (shots: readonly MetricShot[]): Point[] =>
  shots.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
const toMm = (um: number | null) => (um === null ? null : um / 1000)
const sumTenths = (shots: readonly MetricShot[]) =>
  shots.reduce((sum, shot) => sum + (shot.decimalTenths as number), 0)
const sumRings = (shots: readonly MetricShot[]) =>
  shots.reduce((sum, shot) => sum + (shot.ring as number), 0)
const distanceOf = (shot: MetricShot) =>
  hasDistance(shot)
    ? (shot.distanceUm as number)
    : Math.hypot(shot.xUm as number, shot.yUm as number)
const seconds = (ms: number | null) => (ms === null ? null : ms / 1000)
/** Zeiten in Abgabefolge; springt `seq`, fehlt dazwischen ein Schuss, und der Abstand zählt nicht. */
function pace(shots: readonly MetricShot[]) {
  const ordered = inShotOrder(shots)
  const withSeq = ordered.every((shot) => finite(shot.seq))
  const times: (number | null)[] = []
  ordered.forEach((shot, i) => {
    if (withSeq && i > 0 && (shot.seq as number) - (ordered[i - 1].seq as number) > 1) {
      times.push(null)
    }
    times.push(shot.firedAtMs as number)
  })
  return tempo(times)
}

const BOTH: readonly ShotKind[] = ["match", "probe"]
const MATCH_ONLY: readonly ShotKind[] = ["match"]
const SERIES_AND_CARD: readonly MetricScope[] = ["series", "card"]

/** So viele Probeschüsse zählen für den Versatz Probe → Wertung (SF-63). */
const SIGHTER_TAIL = 5

export const METRICS: readonly Readonly<MetricDefinition>[] = Object.freeze([
  defineMetric({
    key: "result.rings",
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
    compute: sumRings,
  }),
  defineMetric({
    key: "result.decimal",
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
    compute: (shots) => sumTenths(shots) / 10,
  }),
  defineMetric({
    key: "result.decimalMean",
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
    compute: (shots) => sumTenths(shots) / 10 / shots.length,
  }),
  defineMetric({
    key: "result.ringsMean",
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
    compute: (shots) => sumRings(shots) / shots.length,
  }),
  defineMetric({
    key: "result.tens",
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
    label: "Innenzehner",
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
    compute: (shots) => shots.filter((shot) => shot.innerTen).length,
  }),
  defineMetric({
    key: "result.bestTeiler",
    label: "bester Teiler",
    unit: "Teiler",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeMisses: false,
    needs: "distance",
    onMissing: "drop",
    compute: (shots) => teilerFromDistanceUm(Math.min(...shots.map(distanceOf))),
  }),
  defineMetric({
    key: "group.mpiDistance",
    label: "Schwerpunkt-Abstand",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 2,
    // Bei wenigen Schüssen streut der Schwerpunkt selbst: Der Abstand hängt von n ab.
    nSensitive: true,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => {
      const center = centroid(points(shots))
      return center === null ? null : Math.hypot(center.xUm, center.yUm) / 1000
    },
  }),
  defineMetric({
    key: "group.enclosingDiameter",
    label: "Streukreis",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
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
    key: "group.meanRadius",
    label: "mittlerer Radius",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => toMm(meanRadius(points(shots))),
  }),
  defineMetric({
    key: "group.r50",
    label: "R50",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 5,
    nSensitive: false,
    excludeMisses: true,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => toMm(r50(points(shots))),
  }),
  defineMetric({
    key: "group.sdX",
    label: "Streuung x",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
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
    label: "Streuung y",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
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
    label: "Tempo (Median)",
    unit: "s",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "none",
    version: 1,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeMisses: false,
    needs: "time",
    onMissing: "drop",
    compute: (shots) => seconds(pace(shots).medianIntervalMs),
  }),
  defineMetric({
    key: "time.longestPause",
    label: "längste Pause",
    unit: "s",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "none",
    version: 1,
    appliesTo: BOTH,
    minShots: 2,
    nSensitive: true,
    excludeMisses: false,
    needs: "time",
    onMissing: "drop",
    compute: (shots) => seconds(pace(shots).longestPauseMs),
  }),
  defineMetric({
    key: "sighter.offset",
    label: "Versatz Probe → Wertung",
    unit: "mm",
    decimals: 2,
    scopes: ["card"],
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 6,
    nSensitive: false,
    excludeMisses: false,
    needs: "position",
    onMissing: "drop",
    compute: (shots) => {
      // Die letzten fünf Probeschüsse vor dem ersten Wertungsschuss: Wer in der Probe das Visier
      // verstellt, will den Schwerpunkt nach der Verstellung sehen (SF-63); Probe nach Beginn der
      // Wertung zählt nicht.
      const ordered = inShotOrder(shots)
      const firstMatch = ordered.findIndex((shot) => shot.kind === "match")
      if (firstMatch < 0) return null
      const sighters = ordered.slice(0, firstMatch).slice(-SIGHTER_TAIL)
      const match = ordered.filter((shot) => shot.kind === "match")
      if (sighters.length < 3 || match.length < 3) return null
      const a = centroid(points(sighters))
      const b = centroid(points(match))
      return a === null || b === null ? null : Math.hypot(a.xUm - b.xUm, a.yUm - b.yUm) / 1000
    },
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
