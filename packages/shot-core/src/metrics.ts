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
import { tempo } from "./time"

export type ShotKind = "match" | "probe"
export type MetricUnit = "Ringe" | "Teiler" | "mm" | "s" | "Schuss" | "%"
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
   * Die Formel. Sie rechnet nur über `computeMetric` richtig: Erst das filtert die Schüsse und
   * garantiert die Angaben, die `needs` verlangt. `context`: Karte und Arten der Auswahl, für Abstände
   * (SF-04).
   */
  compute: (shots: readonly MetricShot[], context: ShotContext) => number | null
}

const KEY = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z0-9]*)+$/
const CATALOG_ID = /^[EPLVZISTRCKWQ]\d+$/

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
  const valueOnly = filter.need === "ring" || filter.need === "decimal"
  if (!valueOnly && flags.includes(FLAG_SUSPICIOUS)) return false
  return !(filter.excludeMisses && flags.includes(FLAG_MISS))
}

const counts = (metric: MetricDefinition, shot: MetricShot) =>
  allowed(shot, {
    kinds: metric.appliesTo,
    need: metric.needs,
    excludeMisses: metric.excludeMisses,
  })

/**
 * Schüsse nach denselben Regeln wie die Registry: Art, verdächtige nur mit ihrem Wert (SF-15),
 * Fehlschüsse auf Wunsch weg (SF-14), gültige Angabe. Für Auswertungen, die keine Kennzahl sind.
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
 * Eine Karte nur mit Probe als Wertung (SF-01, Training; User, 8. Oktober 2026): jeder Schuss wird
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

const pace = (shots: readonly MetricShot[], context?: ShotContext) =>
  tempo(timesWithGaps(shots, context))

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
    compute: (shots) => sumTenths(shots) / 10,
  }),
  defineMetric({
    key: "result.decimalMean",
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
    compute: (shots) => sumTenths(shots) / 10 / shots.length,
  }),
  defineMetric({
    key: "result.ringsMean",
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
    key: "result.tensRate",
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
    version: 1,
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
    catalogId: "P1",
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
    key: "group.r50",
    catalogId: "P4",
    label: "R50",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
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
    catalogId: "P5",
    label: "Präzision σ",
    unit: "mm",
    decimals: 2,
    scopes: SERIES_AND_CARD,
    better: "lower",
    version: 1,
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
    catalogId: "P6",
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
    catalogId: "P6",
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
    catalogId: "Z1",
    label: "Tempo (Median)",
    unit: "s",
    decimals: 0,
    scopes: SERIES_AND_CARD,
    better: "none",
    version: 2,
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
    version: 2,
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
