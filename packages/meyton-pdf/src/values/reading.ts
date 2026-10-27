// Die Lesung eines Ausdrucks: was Spiegel aus den Werten übernimmt, nachdem sie sich selbst geprüft haben
// ([[meyton-printout]] „Werte lesen“). Rein, ohne pdf.js: Der Kindprozess liest mit `readPrintoutValues`, die App prüft
// und speichert nur die Lesung. Jeder Widerspruch zwischen gelesenen Werten und gedruckten Summen, Zählern und Marken
// ergibt `rejected` mit festem Grund; geraten wird nie. Gedruckte Felder, die fehlen, prüft die Lesung nicht.
//
// Die Lesung enthält keinen Namen, keine Nummer, keine ID und kein Datum (ADR-029).

import type {
  CenterMm,
  PointPt,
  PrintoutValues,
  SeriesValues,
  SpreadValue,
  TeilerRef,
} from "./types"

/** Version des Lesers der Werte; steigt sie, liest Spiegel gespeicherte Ausdrucke neu */
export const READER_VERSION = "meyton-values@1"

export type PrintoutLayout = "ghostscript" | "qt" | "unknown"

/** das Layout nach dem Erzeuger im Info-Dict; ein unbekanntes liest der Leser trotzdem, die Selbstprüfung entscheidet */
export function layoutOf({ producer }: { producer: string | null }): PrintoutLayout {
  if (producer === null) return "unknown"
  if (/^GPL Ghostscript\b/.test(producer)) return "ghostscript"
  if (/^Qt \d/.test(producer)) return "qt"
  return "unknown"
}

export type ReadingProblem =
  | "empty"
  | "mode"
  | "shotValue"
  | "series"
  | "sums"
  | "innerTens"
  | "counts"
  | "marks"
  | "teilerRefs"

export interface ReadingShot {
  /** Nummer der gedruckten Serie */
  series: number | null
  /** Wert in Zehnteln (104 = 10,4) */
  decimalTenths: number
  innerTen: boolean
}

export interface ReadingSeries {
  number: number
  shots: number
  /** Summe in ganzen Ringen, Ring je Schuss wie bei Meyton: min(10, ⌊Wert⌋) */
  rings: number
  decimalTenths: number
  centerMm: CenterMm | null
  hitCircleMm: number | null
  spread: SpreadValue | null
  bestTeiler: TeilerRef[] | null
}

export interface ReadingPicture {
  centerPt: PointPt
  /** Durchmesser der Ringe in Punkt, absteigend */
  ringDiametersPt: number[]
  /** Mitten der Marken in Schussfolge */
  holesPt: PointPt[]
}

export interface PrintoutReading {
  layout: PrintoutLayout
  discipline: string | null
  stand: string | null
  /** Modus Probe: alle Schüsse sind Probe, keine Summen */
  probe: boolean
  shots: ReadingShot[]
  /** die Serien mit Schüssen, in Folge */
  series: ReadingSeries[]
  /** Ergebnis der Wertung; im Modus Probe null */
  total: { rings: number; decimalTenths: number } | null
  centerMm: CenterMm | null
  hitCircleMm: number | null
  spread: SpreadValue | null
  bestTeiler: TeilerRef[] | null
  widestTeiler: TeilerRef[] | null
  /** `pictures[0]` die ganze Scheibe, danach je Serie aus `series` eins; leer ohne Trefferbild */
  pictures: ReadingPicture[]
}

export type ReadingResult =
  | { kind: "ok"; reading: PrintoutReading }
  | {
      kind: "rejected"
      layout: PrintoutLayout
      problem: ReadingProblem
      discipline: string | null
    }

const PROBE_MODES = new Set(["Probe", "Vorbereitung/Probe"])
const SCORED_MODE = "Wertung"
const MAX_VALUE = 109
const INNER_TEN_FROM = 100

/** Ring eines Werts wie bei Meyton: die ganze Zahl, höchstens 10 */
export const ringOf = (decimalTenths: number) => Math.min(10, Math.floor(decimalTenths / 10))

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
const sameList = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i])

/** Ringe und Zehntel der Werte, wie Meyton sie summiert */
function totals(values: readonly number[]) {
  return { rings: sum(values.map(ringOf)), decimalTenths: sum(values) }
}

/** stimmt eine gedruckte Summe? Fehlende Teile prüft sie nicht */
function sumFits(
  printed: { rings: number | null; tenths: number | null } | null,
  values: readonly number[]
) {
  if (printed === null) return true
  const actual = totals(values)
  return (
    (printed.rings === null || printed.rings === actual.rings) &&
    (printed.tenths === null || printed.tenths === actual.decimalTenths)
  )
}

/**
 * Welche gedruckten Serien die Bilder je Serie tragen: alle oder nur die mit Schüssen. Ohne Bilder je Serie leer; null,
 * wenn keine Zuordnung passt.
 */
function picturedSeries(
  values: PrintoutValues,
  withShots: readonly SeriesValues[]
): readonly SeriesValues[] | null {
  const perSeries = values.pictures.slice(1)
  if (perSeries.length === 0) return []
  for (const candidate of [values.series, withShots]) {
    if (
      candidate.length === perSeries.length &&
      candidate.every((series, i) => perSeries[i].holes.length === series.shots.length)
    )
      return candidate
  }
  return null
}

/**
 * Prüft die Werte eines Ausdrucks in sich und baut die Lesung. Folge der Prüfungen: Schüsse da, Modus, Werte,
 * Serien (Wertung), Summen, Innenzehner, Zähler, Marken, Schussnummern der Teiler.
 */
export function printoutReading(
  values: PrintoutValues,
  meta: { producer: string | null }
): ReadingResult {
  const layout = layoutOf(meta)
  const reject = (problem: ReadingProblem): ReadingResult => ({
    kind: "rejected",
    layout,
    problem,
    discipline: values.discipline,
  })

  const shots = values.shots
  if (shots.length === 0) return reject("empty")

  const mode = values.mode?.trim() ?? null
  const probe = mode !== null && PROBE_MODES.has(mode)
  if (!probe && mode !== SCORED_MODE) return reject("mode")

  if (
    shots.some(
      (shot) =>
        !Number.isInteger(shot.value) ||
        shot.value < 0 ||
        shot.value > MAX_VALUE ||
        (shot.innerTen && shot.value < INNER_TEN_FROM)
    )
  )
    return reject("shotValue")

  if (!probe) {
    const numbers = values.series.map((series) => series.number)
    if (!numbers.every((number, i) => number === i + 1)) return reject("series")
  }

  const all = shots.map((shot) => shot.value)
  const valuesOf = (series: SeriesValues) => series.shots.map((shot) => shot.value)
  if (!values.series.every((series) => sumFits(series.sum, valuesOf(series)))) return reject("sums")
  if (
    values.seriesRings !== null &&
    !sameList(
      values.seriesRings,
      values.series.map((series) => totals(valuesOf(series)).rings)
    ) &&
    !sameList(
      values.seriesRings,
      values.series.filter((s) => s.shots.length > 0).map((s) => totals(valuesOf(s)).rings)
    )
  )
    return reject("sums")
  if (!sumFits(values.result, all)) return reject("sums")

  if (values.innerTens !== null && values.innerTens !== shots.filter((s) => s.innerTen).length)
    return reject("innerTens")

  if (values.counts !== null) {
    // Zähler von 10 bis 0; eine Trainingsscheibe druckt 12 Felder, die Regel kennt sie nicht
    if (values.counts.length !== 11) return reject("counts")
    const counted = values.counts.map((_, i) => all.filter((v) => ringOf(v) === 10 - i).length)
    if (!sameList(values.counts, counted)) return reject("counts")
  }

  const withShots = values.series.filter((series) => series.shots.length > 0)
  let pictured: readonly SeriesValues[] = []
  if (values.pictures.length > 0) {
    if (values.pictures[0].holes.length !== shots.length) return reject("marks")
    const matched = picturedSeries(values, withShots)
    if (matched === null) return reject("marks")
    pictured = matched
  }

  const refs = [
    ...(values.bestTeiler ?? []),
    ...(values.widestTeiler ?? []),
    ...values.series.flatMap((series) => series.bestTeiler ?? []),
  ]
  if (refs.some((ref) => !Number.isInteger(ref.shot) || ref.shot < 1 || ref.shot > shots.length))
    return reject("teilerRefs")

  // die Bilder der Serien in der Folge von `series`; Serien ohne Schüsse tragen kein Bild
  const pictureOf = new Map(pictured.map((series, i) => [series, values.pictures[i + 1]]))
  const pictures =
    values.pictures.length === 0
      ? []
      : [
          values.pictures[0],
          ...(pictured.length === 0 ? [] : withShots.map((series) => pictureOf.get(series)!)),
        ]

  return {
    kind: "ok",
    reading: {
      layout,
      discipline: values.discipline,
      stand: values.stand,
      probe,
      shots: shots.map((shot) => ({
        series: shot.series,
        decimalTenths: shot.value,
        innerTen: shot.innerTen,
      })),
      series: withShots.map((series) => ({
        number: series.number,
        shots: series.shots.length,
        ...totals(valuesOf(series)),
        centerMm: series.centerMm,
        hitCircleMm: series.hitCircleMm,
        spread: series.spread,
        bestTeiler: series.bestTeiler,
      })),
      total: probe ? null : totals(all),
      centerMm: values.centerMm,
      hitCircleMm: values.hitCircleMm,
      spread: values.spread,
      bestTeiler: values.bestTeiler,
      widestTeiler: values.widestTeiler,
      pictures: pictures.map((picture) => ({
        centerPt: { x: picture.center.x, y: picture.center.y },
        ringDiametersPt: [...picture.ringDiametersPt],
        holesPt: picture.holes.map((hole) => ({ x: hole.x, y: hole.y })),
      })),
    },
  }
}
