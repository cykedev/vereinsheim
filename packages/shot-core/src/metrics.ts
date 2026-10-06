// Kennzahlen-Registry: Jede Kennzahl ist eine reine, versionierte Funktion mit Einheit, Richtung und
// Regeln dafür, welche Schüsse zählen. Daraus entstehen später ohne weiteren Code die Kachel in der
// Session, die Spalte im Serienvergleich, der Verlauf und der Vergleich (vault/spiegel/spiegel-metrics.md).
//
// Regeln aus dem Sonderfall-Katalog: Ergebnis-Kennzahlen gelten nur für Wertungsschüsse, Lage und
// Tempo auch für die Probe (SF-01); unter der Mindestzahl gibt es keinen Wert statt 0 (SF-61);
// robuste Maße lassen markierte Schüsse weg (SF-14); `nSensitive` kennzeichnet Maße, die mit der
// Schusszahl wachsen, damit Vergleiche nur bei gleichem n laufen (SF-60).
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
export type MetricUnit = "Ringe" | "Zehntel" | "Teiler" | "mm" | "s" | "Schuss"
export type MetricScope = "series" | "card"
export type MetricNeed = "value" | "position" | "distance" | "time"

export interface MetricShot {
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
  /** etwa "fehlschuss", "verdaechtig" (SF-14, SF-15) */
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
  /** wächst mit der Schusszahl: Vergleiche nur bei gleichem n (SF-60) */
  nSensitive: boolean
  /** markierte Schüsse weglassen (robuste Maße, SF-14) */
  excludeFlagged: boolean
  /** welche Angabe die Schüsse brauchen */
  needs: MetricNeed
  compute: (shots: readonly MetricShot[]) => number | null
}

/** Merkmale, die einen Schuss für robuste Maße ausschließen */
const OUTLIER_FLAGS = ["fehlschuss", "verdaechtig"]

export function defineMetric(def: MetricDefinition): Readonly<MetricDefinition> {
  if (!Number.isInteger(def.version) || def.version < 1) {
    throw new RangeError(`${def.key}: Version muss eine ganze Zahl ab 1 sein`)
  }
  if (!Number.isInteger(def.minShots) || def.minShots < 1) {
    throw new RangeError(`${def.key}: Mindestzahl muss ab 1 sein`)
  }
  if (def.appliesTo.length === 0 || def.scopes.length === 0) {
    throw new RangeError(`${def.key}: appliesTo und scopes dürfen nicht leer sein`)
  }
  return Object.freeze({
    ...def,
    scopes: Object.freeze([...def.scopes]),
    appliesTo: Object.freeze([...def.appliesTo]),
  })
}

function hasPosition(shot: MetricShot): boolean {
  return shot.xUm !== null && shot.yUm !== null
}

function satisfies(shot: MetricShot, need: MetricNeed): boolean {
  switch (need) {
    case "value":
      return shot.decimalTenths !== null && shot.ring !== null
    case "position":
      return hasPosition(shot)
    case "distance":
      return (shot.distanceUm ?? null) !== null || hasPosition(shot)
    case "time":
      return shot.firedAtMs !== null
  }
}

export function computeMetric(
  metric: MetricDefinition,
  shots: readonly MetricShot[]
): number | null {
  const eligible = shots.filter(
    (shot) =>
      metric.appliesTo.includes(shot.kind) &&
      satisfies(shot, metric.needs) &&
      !(metric.excludeFlagged && shot.flags?.some((flag) => OUTLIER_FLAGS.includes(flag)))
  )
  if (eligible.length < metric.minShots) return null
  return metric.compute(eligible)
}

// ---------------------------------------------------------------------------------------------
// Hilfen für die Definitionen. Die Filter in computeMetric garantieren die nötigen Angaben.

const points = (shots: readonly MetricShot[]): Point[] =>
  shots.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
const toMm = (um: number | null) => (um === null ? null : um / 1000)
const sumTenths = (shots: readonly MetricShot[]) =>
  shots.reduce((sum, shot) => sum + (shot.decimalTenths as number), 0)
const distanceOf = (shot: MetricShot) =>
  shot.distanceUm ?? Math.hypot(shot.xUm as number, shot.yUm as number)
const seconds = (ms: number | null) => (ms === null ? null : ms / 1000)

/** zeitlich geordnet, wenn alle Zeiten bekannt sind; sonst in der gegebenen Folge */
function chronological(shots: readonly MetricShot[]): MetricShot[] {
  return shots.every((shot) => shot.firedAtMs !== null)
    ? [...shots].sort((a, b) => (a.firedAtMs as number) - (b.firedAtMs as number))
    : [...shots]
}

const BOTH: readonly ShotKind[] = ["match", "probe"]
const MATCH_ONLY: readonly ShotKind[] = ["match"]
const SERIES_AND_CARD: readonly MetricScope[] = ["series", "card"]

/** So viele Probeschüsse zählen für den Versatz Probe → Wertung (SF-63). */
const SIGHTER_TAIL = 5

export const METRICS: readonly Readonly<MetricDefinition>[] = [
  defineMetric({
    key: "result.rings",
    label: "Ringe",
    unit: "Ringe",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeFlagged: false,
    needs: "value",
    compute: (shots) => shots.reduce((sum, shot) => sum + (shot.ring as number), 0),
  }),
  defineMetric({
    key: "result.decimal",
    label: "Zehntel",
    unit: "Zehntel",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: true,
    excludeFlagged: false,
    needs: "value",
    compute: (shots) => sumTenths(shots) / 10,
  }),
  defineMetric({
    key: "result.decimalMean",
    label: "Ø je Schuss",
    unit: "Zehntel",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "higher",
    version: 1,
    appliesTo: MATCH_ONLY,
    minShots: 1,
    nSensitive: false,
    excludeFlagged: false,
    needs: "value",
    compute: (shots) => sumTenths(shots) / 10 / shots.length,
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
    excludeFlagged: false,
    needs: "value",
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
    excludeFlagged: false,
    needs: "value",
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
    excludeFlagged: false,
    needs: "distance",
    compute: (shots) => teilerFromDistanceUm(Math.min(...shots.map(distanceOf))),
  }),
  defineMetric({
    key: "group.mpiDistance",
    label: "Schwerpunkt-Abstand",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 2,
    nSensitive: false,
    excludeFlagged: false,
    needs: "position",
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
    excludeFlagged: false,
    needs: "position",
    compute: (shots) => {
      const circle = smallestEnclosingCircle(points(shots))
      return circle === null ? null : (2 * circle.radiusUm) / 1000
    },
  }),
  defineMetric({
    key: "group.meanRadius",
    label: "mittlerer Radius",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeFlagged: false,
    needs: "position",
    compute: (shots) => toMm(meanRadius(points(shots))),
  }),
  defineMetric({
    key: "group.r50",
    label: "R50",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 5,
    nSensitive: false,
    excludeFlagged: true,
    needs: "position",
    compute: (shots) => toMm(r50(points(shots))),
  }),
  defineMetric({
    key: "group.sdX",
    label: "Streuung x",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeFlagged: false,
    needs: "position",
    compute: (shots) => toMm(standardDeviation(shots.map((shot) => shot.xUm as number))),
  }),
  defineMetric({
    key: "group.sdY",
    label: "Streuung y",
    unit: "mm",
    decimals: 1,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 3,
    nSensitive: false,
    excludeFlagged: false,
    needs: "position",
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
    excludeFlagged: false,
    needs: "time",
    compute: (shots) =>
      seconds(tempo(shots.map((shot) => shot.firedAtMs as number)).medianIntervalMs),
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
    excludeFlagged: false,
    needs: "time",
    compute: (shots) =>
      seconds(tempo(shots.map((shot) => shot.firedAtMs as number)).longestPauseMs),
  }),
  defineMetric({
    key: "sighter.offset",
    label: "Versatz Probe → Wertung",
    unit: "mm",
    decimals: 1,
    scopes: ["card"],
    better: "lower",
    version: 1,
    appliesTo: BOTH,
    minShots: 6,
    nSensitive: false,
    excludeFlagged: false,
    needs: "position",
    compute: (shots) => {
      // Nur die letzten fünf Probeschüsse: Wer in der Probe das Visier verstellt, will den
      // Schwerpunkt nach der Verstellung sehen (SF-63).
      const sighters = chronological(shots.filter((shot) => shot.kind === "probe")).slice(
        -SIGHTER_TAIL
      )
      const match = shots.filter((shot) => shot.kind === "match")
      if (sighters.length < 3 || match.length < 3) return null
      const a = centroid(points(sighters))
      const b = centroid(points(match))
      return a === null || b === null ? null : Math.hypot(a.xUm - b.xUm, a.yUm - b.yUm) / 1000
    },
  }),
]

const BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]))

export function metricByKey(key: string): Readonly<MetricDefinition> | undefined {
  return BY_KEY.get(key)
}
