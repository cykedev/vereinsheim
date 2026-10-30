// Angaben einer Scheibe aus der Lesung eines Ausdrucks ([[meyton-printout]] „Werte lesen“). Rein: Maßstab und Mitte
// jedes Trefferbilds aus seinen Ringen gegen das Scheibenbild der Disziplin, die Lage je Schuss in µm, dann prüfen, ob
// Trefferlage, Trefferkreis, Streuwert und Teiler des Ausdrucks zu diesen Lagen passen. Nur, was gedruckt ist, wird
// geprüft; jeder Widerspruch gibt einen festen Grund und keine Werte (nie raten).
//
// Der Teiler je Schuss wird nicht gespeichert: Spiegel rechnet ihn aus der Lage (`shotDistanceUm`), eine Regel für
// jeden Schuss; die gedruckten Teiler (abgeschnitten) dienen nur der Prüfung.

import type { PointPt } from "@vereinsheim/meyton-pdf/values"
import { ringOf, type PrintoutReading } from "@vereinsheim/meyton-pdf/reading"
import {
  centroid,
  smallestEnclosingCircle,
  standardDeviation,
} from "@vereinsheim/shot-core/geometry"
import { TARGETS, type TargetId, type TargetImage } from "@vereinsheim/shot-core/targets"

import { checkDetails, type DetailsInput, type EnteredShot } from "../entered/details"
import { verifyShots } from "../ingest/card-checks"

const MM = 1000

/** Durchmesser der Ringe der Scheibe in mm, absteigend: Ring 1 bis 10, dann der Innenzehner */
export function ringDiametersMm(target: TargetImage): number[] {
  return [...target.ringRadiiUm.map((r) => (2 * r) / MM), target.innerTen.diameterMm]
}

/**
 * die Ringe, wie ein Trefferbild sie zeigt: gleiche Durchmesser einmal, wie der Leser sie zusammenfasst. Beim Luftgewehr
 * sind Ring 10 und Innenzehn beide 0,5 mm, gezeichnet ist ein Kreis
 */
export function drawnRingDiametersMm(target: TargetImage): number[] {
  return ringDiametersMm(target).filter(
    (mm, i, all) => !all.slice(0, i).some((before) => Math.abs(before - mm) < 1e-9)
  )
}

function median(sorted: readonly number[]): number {
  const mid = sorted.length / 2
  return sorted.length % 2 === 1 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Punkt je mm aus den gezeichneten Ringen (Median der Verhältnisse); null, wenn die Zahl der Ringe nicht passt */
export function scaleFromRings(
  ringPt: readonly number[],
  ringMm: readonly number[]
): number | null {
  if (ringPt.length !== ringMm.length || ringPt.length === 0) return null
  const ratios = ringPt.map((pt, i) => pt / ringMm[i]).sort((a, b) => a - b)
  return median(ratios)
}

export type ValuesProblem =
  "rings" | "marks" | "center" | "circle" | "spread" | "teiler" | "details"

export type DetailsFromReading =
  { ok: true; details: DetailsInput; stand: string | null } | { ok: false; problem: ValuesProblem }

/** jedes Verhältnis Punkt je mm höchstens so weit neben dem Median */
const SCALE_TOLERANCE = 0.005
/** Bild der ganzen Scheibe gegen Bild der Serie, je Schuss in mm */
const PICTURE_TOLERANCE_MM = 0.05
/** Trefferlage (abgeschnitten), Trefferkreis und Streuwert (gerundet) gegen die Lagen, in mm */
const GROUP_TOLERANCE_MM = 0.02
/** beste Teiler (auf 0,1 abgeschnitten) und weiteste (ganz abgeschnitten) gegen die Lage, in 1/100 mm */
const BEST_TEILER_TOLERANCE = 1.5
const WIDEST_TEILER_TOLERANCE = 2.0

interface Placed {
  xUm: number
  yUm: number
}

/** Mitte und Maßstab eines Bilds aus seinen Ringen; null, wenn Zahl oder Verhältnisse der Ringe nicht passen */
function frameOf(
  picture: PrintoutReading["pictures"][number],
  ringMm: readonly number[]
): { center: PointPt; ptPerMm: number } | null {
  const scale = scaleFromRings(picture.ringDiametersPt, ringMm)
  if (scale === null || !(scale > 0)) return null
  const off = picture.ringDiametersPt.some(
    (pt, i) => Math.abs(pt / ringMm[i] / scale - 1) > SCALE_TOLERANCE
  )
  return off ? null : { center: picture.centerPt, ptPerMm: scale }
}

/** Lage einer Marke in mm, x nach rechts, y nach oben wie im PDF */
const markMm = (frame: { center: PointPt; ptPerMm: number }, hole: PointPt) => ({
  x: (hole.x - frame.center.x) / frame.ptPerMm,
  y: (hole.y - frame.center.y) / frame.ptPerMm,
})
/** auf das Raster der Rohdaten (10 µm) */
const toUm = (mm: number) => Math.round(mm * 100) * 10

/**
 * Lage je Schuss: aus dem Bild seiner Serie (eigener Maßstab, kleinerer Ausschnitt), gegengeprüft am Bild der ganzen
 * Scheibe; ohne Bilder je Serie aus dem Bild der ganzen Scheibe. Null ohne Trefferbild.
 */
function positionsOf(
  reading: PrintoutReading,
  target: TargetImage | null
): { ok: true; positions: Placed[] | null } | { ok: false; problem: ValuesProblem } {
  if (reading.pictures.length === 0) return { ok: true, positions: null }
  if (target === null) return { ok: false, problem: "rings" }
  const ringMm = drawnRingDiametersMm(target)
  const frames = reading.pictures.map((picture) => frameOf(picture, ringMm))
  if (frames.some((frame) => frame === null)) return { ok: false, problem: "rings" }

  const whole = reading.pictures[0].holesPt.map((hole) => markMm(frames[0]!, hole))
  if (whole.length !== reading.shots.length) return { ok: false, problem: "marks" }
  if (reading.pictures.length === 1) {
    return { ok: true, positions: whole.map((p) => ({ xUm: toUm(p.x), yUm: toUm(p.y) })) }
  }
  if (reading.pictures.length !== reading.series.length + 1) return { ok: false, problem: "marks" }

  const positions: Placed[] = []
  let at = 0
  for (const [i, series] of reading.series.entries()) {
    const holes = reading.pictures[i + 1].holesPt
    if (holes.length !== series.shots) return { ok: false, problem: "marks" }
    for (const hole of holes) {
      const shot = reading.shots[at]
      if (shot === undefined || shot.series !== series.number)
        return { ok: false, problem: "marks" }
      const mm = markMm(frames[i + 1]!, hole)
      const check = whole[at]
      if (Math.hypot(mm.x - check.x, mm.y - check.y) > PICTURE_TOLERANCE_MM)
        return { ok: false, problem: "marks" }
      positions.push({ xUm: toUm(mm.x), yUm: toUm(mm.y) })
      at++
    }
  }
  if (at !== reading.shots.length) return { ok: false, problem: "marks" }
  return { ok: true, positions }
}

const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance + 1e-9

/** passen Trefferlage, Trefferkreis und Streuwert, die zu dieser Gruppe gedruckt sind? */
function groupProblem(
  printed: Pick<PrintoutReading, "centerMm" | "hitCircleMm" | "spread">,
  group: readonly Placed[],
  caliberMm: number
): ValuesProblem | null {
  if (group.length === 0) return null
  const points = group.map((p) => ({ xUm: p.xUm / MM, yUm: p.yUm / MM }))
  if (printed.centerMm !== null) {
    const center = centroid(points)!
    if (
      !near(center.xUm, printed.centerMm.x, GROUP_TOLERANCE_MM) ||
      !near(center.yUm, printed.centerMm.y, GROUP_TOLERANCE_MM)
    )
      return "center"
  }
  if (printed.hitCircleMm !== null) {
    const circle = smallestEnclosingCircle(points)!
    if (!near(2 * circle.radiusUm + caliberMm, printed.hitCircleMm, GROUP_TOLERANCE_MM))
      return "circle"
  }
  if (printed.spread !== null) {
    const sx = standardDeviation(points.map((p) => p.xUm))
    const sy = standardDeviation(points.map((p) => p.yUm))
    // unter zwei Schüssen gibt es keine Streuung zu prüfen
    if (sx !== null && sy !== null) {
      const overall = Math.sqrt((sx * sx + sy * sy) / 2)
      if (
        !near(overall, printed.spread.overall, GROUP_TOLERANCE_MM) ||
        (printed.spread.horizontal !== null &&
          !near(sx, printed.spread.horizontal, GROUP_TOLERANCE_MM)) ||
        (printed.spread.vertical !== null && !near(sy, printed.spread.vertical, GROUP_TOLERANCE_MM))
      )
        return "spread"
    }
  }
  return null
}

/** passen die gedruckten Teiler (1/100 mm) zum Abstand des genannten Schusses? */
function teilerFits(
  refs: readonly { value: number; shot: number }[] | null,
  positions: readonly Placed[],
  tolerance: number
): boolean {
  return (refs ?? []).every((ref) => {
    const p = positions[ref.shot - 1]
    return p !== undefined && Math.abs(Math.hypot(p.xUm, p.yUm) / 10 - ref.value) <= tolerance
  })
}

/**
 * Die Angaben einer Scheibe aus einer Lesung, für `writeEnteredCardIn`: Schüsse mit Wert, Innenzehner und Lage, in
 * Wertung dazu Serien und Gesamtergebnis wie gedruckt, im Modus Probe ohne Summen. Ohne Scheibenbild (eigene Scheibe
 * der Disziplin) gehen Bilder nicht: `rings`.
 */
export function detailsFromReading(
  reading: PrintoutReading,
  targetId: TargetId | null
): DetailsFromReading {
  const target = targetId !== null && Object.hasOwn(TARGETS, targetId) ? TARGETS[targetId] : null
  const placed = positionsOf(reading, target)
  if (!placed.ok) return placed
  const { positions } = placed

  if (positions !== null && target !== null) {
    const whole = groupProblem(reading, positions, target.caliberMm)
    if (whole) return { ok: false, problem: whole }
    let at = 0
    for (const series of reading.series) {
      const group = positions.slice(at, at + series.shots)
      at += series.shots
      const problem = groupProblem(series, group, target.caliberMm)
      if (problem) return { ok: false, problem }
    }
    const best = [reading.bestTeiler, ...reading.series.map((s) => s.bestTeiler)]
    if (
      !best.every((refs) => teilerFits(refs, positions, BEST_TEILER_TOLERANCE)) ||
      !teilerFits(reading.widestTeiler, positions, WIDEST_TEILER_TOLERANCE)
    )
      return { ok: false, problem: "teiler" }
  }

  const shots: EnteredShot[] = reading.shots.map((shot, i) => ({
    series: reading.probe ? null : shot.series,
    ring: Math.min(10, Math.floor(shot.decimalTenths / 10)),
    decimalTenths: shot.decimalTenths,
    innerTen: shot.innerTen,
    xUm: positions?.[i].xUm ?? null,
    yUm: positions?.[i].yUm ?? null,
    distanceTenthsUm: null,
    probe: reading.probe,
  }))
  const details: DetailsInput = reading.probe
    ? { shots }
    : {
        shots,
        series: reading.series.map((s) => ({
          series: s.number,
          shots: s.shots,
          rings: s.rings,
          decimalTenths: s.decimalTenths,
        })),
        total:
          reading.total === null
            ? null
            : {
                shots: reading.shots.length,
                rings: reading.total.rings,
                decimalTenths: reading.total.decimalTenths,
              },
      }
  if (!checkDetails(details, { plannedShots: null, seriesShots: null }).ok)
    return { ok: false, problem: "details" }
  // jede Marke muss den gedruckten Wert ihres Schusses tragen (Gegenprobe wie beim Einlesen): sonst gehören die Marken
  // anderen Schüssen, etwa in einer anderen Folge gezeichnet
  if (positions !== null && targetId !== null) {
    const { suspicious } = verifyShots(
      targetId,
      shots.map((shot) => ({
        xUm: shot.xUm ?? null,
        yUm: shot.yUm ?? null,
        distanceTenthsUm: null,
        decimalTenths: shot.decimalTenths,
        ring: shot.ring,
        innerTen: shot.innerTen ?? null,
        flags: [],
      }))
    )
    if (suspicious.some(Boolean)) return { ok: false, problem: "marks" }
  }
  return { ok: true, details, stand: reading.stand }
}

/**
 * Eine Lesung im Modus Probe als Wertung ([[spiegel-account-transfer]]): Treffsicher hat Probe-Ausdrucke als Training
 * gewertet. Die Schüsse behalten ihre Serien, das Ergebnis ist ihre Summe (ganze Ringe wie Meyton, `ringOf`). Eine
 * Lesung der Wertung bleibt, wie sie ist.
 */
export function scoringReading(reading: PrintoutReading): PrintoutReading {
  if (!reading.probe) return reading
  return {
    ...reading,
    probe: false,
    total: {
      rings: reading.shots.reduce((sum, shot) => sum + ringOf(shot.decimalTenths), 0),
      decimalTenths: reading.shots.reduce((sum, shot) => sum + shot.decimalTenths, 0),
    },
  }
}

/**
 * Passt eine Lesung zu den Zahlen aus Treffsicher, mit denen eine übernommene Scheibe angelegt wurde
 * ([[spiegel-account-transfer]])? Als Wertung gelesen (`scoringReading`) braucht sie ein Gesamtergebnis und dieselbe
 * Schusszahl; das Ergebnis ist gleich in Zehnteln, wenn sie eingetragen sind, sonst in Ringen. Ohne eingetragenes
 * Ergebnis passt nichts. Der Abend zählt nicht: Die Ausdrucke hängen schon an der Scheibe.
 */
export function fitsEnteredTotal(
  read: PrintoutReading,
  totals: {
    totalRings: number | null
    totalDecimalTenths: number | null
    totalShots: number | null
  }
): boolean {
  const reading = scoringReading(read)
  if (!reading.total || totals.totalShots === null) return false
  if (reading.shots.length !== totals.totalShots) return false
  if (totals.totalDecimalTenths !== null)
    return reading.total.decimalTenths === totals.totalDecimalTenths
  return totals.totalRings !== null && reading.total.rings === totals.totalRings
}

/**
 * Welche Ausdrucke einer Scheibe Werte geben können, der beste zuerst: mit gespeicherter Lesung (in sich stimmig, auch
 * wenn sie zur bisherigen Disziplin nicht passte), der zuletzt gedruckte vorn (ein späterer Ausdruck derselben Scheibe
 * hat mindestens so viele Schüsse), bei gleicher Druckzeit der zuletzt gespeicherte.
 */
export function readingOrder<
  T extends { reading: unknown; printedAt: Date | null; storedAt: Date },
>(printouts: readonly T[]): T[] {
  const time = (date: Date | null) => date?.getTime() ?? -Infinity
  return printouts
    .filter((p) => p.reading !== null && p.reading !== undefined)
    .sort(
      (a, b) => time(b.printedAt) - time(a.printedAt) || b.storedAt.getTime() - a.storedAt.getTime()
    )
}
