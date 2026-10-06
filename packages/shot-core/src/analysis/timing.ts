// Zeit und Rhythmus: Tempo-Konstanz, Dauer und Netto-Schießzeit, Wiedereinstieg nach Pausen und ein
// Rhythmus-Profil über die Schussnummer (Katalog Z2–Z5). Zeiten in Abgabefolge; fehlt ein Schuss oder
// springt die Uhr zurück, zählt der Abstand nicht (SF-30). Intervalle über drei Minuten sind Pausen.

import {
  selectShots,
  shotSteps,
  timesWithGaps,
  type MetricShot,
  type Scoring,
  type ShotKind,
} from "../metrics"
import { iqr, median } from "../stats"
import { PAUSE_THRESHOLD_MS, tempo } from "../time"
import { valueNeed, valueTenths } from "./values"

const MATCH: readonly ShotKind[] = ["match"]

interface Interval {
  shot: MetricShot
  /** Nummer in der Abgabefolge der ausgewählten Schüsse, ab 1 */
  number: number
  /** Abstand zum vorigen Schuss; null beim ersten, nach einer Lücke oder einem Rücksprung der Uhr */
  intervalMs: number | null
}

function intervals(shots: readonly MetricShot[]): Interval[] {
  const steps = shotSteps(shots)
  return steps.map((step, i) => {
    const before = steps[i - 1]?.shot
    const now = step.shot.firedAtMs
    const then = before?.firedAtMs
    const gap =
      !step.gapBefore && Number.isFinite(now) && Number.isFinite(then)
        ? (now as number) - (then as number)
        : Number.NaN
    return { shot: step.shot, number: i + 1, intervalMs: gap >= 0 ? gap : null }
  })
}

const timed = (shots: readonly MetricShot[]) => selectShots(shots, { need: "time" })

/** Streuung des Tempos: IQR der Intervalle ohne Pausen, auch relativ zum Median; ab drei Intervallen */
export function tempoSpread(
  shots: readonly MetricShot[]
): { n: number; iqrMs: number; medianMs: number; relative: number | null } | null {
  const pace = tempo(timesWithGaps(timed(shots)))
  if (pace.intervalsMs.length < 3) return null
  const spread = iqr(pace.intervalsMs) as number
  const center = median(pace.intervalsMs) as number
  return {
    n: pace.intervalsMs.length,
    iqrMs: spread,
    medianMs: center,
    relative: center > 0 ? spread / center : null,
  }
}

/** Dauer (null nach einem Sprung der Uhr), Netto-Zeit ohne Pausen und Schüsse je Netto-Stunde */
export function shootingTime(
  shots: readonly MetricShot[]
): { n: number; durationMs: number | null; netMs: number; shotsPerHour: number | null } | null {
  const selected = timed(shots)
  if (selected.length < 2) return null
  const pace = tempo(timesWithGaps(selected))
  const netMs = pace.intervalsMs.reduce((sum, ms) => sum + ms, 0)
  return {
    n: selected.length,
    durationMs: pace.durationMs,
    netMs,
    shotsPerHour: netMs > 0 ? selected.length / (netMs / 3_600_000) : null,
  }
}

export interface PauseEffect {
  /** Nummer des ersten Wertungsschusses nach der Pause */
  afterShot: number
  /** Ø der bis zu drei Schüsse danach minus Scheiben-Ø, in Ringen der gewählten Wertung */
  deltaRings: number
}

/** Pausen und Wiedereinstieg (Z4), über die Wertungsschüsse mit Zeit und Wert */
export function pauseRecovery(
  shots: readonly MetricShot[],
  scoring: Scoring
): {
  pauses: number
  totalPauseMs: number
  effects: PauseEffect[]
  meanDelta: number | null
} | null {
  const withValue = new Set(selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) }))
  const selected = selectShots(shots, { kinds: MATCH, need: "time" }).filter((shot) =>
    withValue.has(shot)
  )
  if (selected.length === 0) return null
  const steps = intervals(selected)
  const values = steps.map((step) => valueTenths(step.shot, scoring))
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const effects: PauseEffect[] = []
  let totalPauseMs = 0
  steps.forEach((step, i) => {
    if (step.intervalMs === null || step.intervalMs <= PAUSE_THRESHOLD_MS) return
    totalPauseMs += step.intervalMs
    const next = values.slice(i, i + 3)
    const nextMean = next.reduce((sum, v) => sum + v, 0) / next.length
    effects.push({ afterShot: step.number, deltaRings: (nextMean - mean) / 10 })
  })
  return {
    pauses: effects.length,
    totalPauseMs,
    effects,
    meanDelta: effects.length
      ? effects.reduce((sum, e) => sum + e.deltaRings, 0) / effects.length
      : null,
  }
}

export interface RhythmPoint {
  number: number
  intervalMs: number | null
  pause: boolean
  /** Median der letzten bis zu `window` Intervalle ohne Pausen bis zu diesem Schuss */
  medianMs: number | null
}

/** Rhythmus-Profil über die Schussnummer (Z5) */
export function rhythmProfile(shots: readonly MetricShot[], window = 5): RhythmPoint[] {
  const recent: number[] = []
  return intervals(timed(shots)).map((step) => {
    const pause = step.intervalMs !== null && step.intervalMs > PAUSE_THRESHOLD_MS
    if (step.intervalMs !== null && !pause) {
      recent.push(step.intervalMs)
      if (recent.length > window) recent.shift()
    }
    return { number: step.number, intervalMs: step.intervalMs, pause, medianMs: median(recent) }
  })
}
