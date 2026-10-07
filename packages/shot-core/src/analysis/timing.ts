// Zeit und Rhythmus: Tempo-Konstanz, Wiedereinstieg nach Pausen und ein Rhythmus-Profil über die
// Schussnummer (Katalog Z2, Z4, Z5); die Dauer (Z3) liefert die Registry (`time.duration`). Zeiten
// in Abgabefolge; fehlt ein Schuss oder springt die Uhr zurück, zählt der Abstand nicht (SF-30).
// Intervalle über drei Minuten sind Pausen.

import {
  inShotOrder,
  selectShots,
  shotNumbers,
  stepsInOrder,
  timesInOrder,
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
  /** Nummer in der Abgabefolge seiner Art über alle gegebenen Schüsse (`shotNumbers`) */
  number: number
  /** Abstand zum vorigen Schuss; null beim ersten, nach einer Lücke oder einem Rücksprung der Uhr */
  intervalMs: number | null
}

/** Abstände über Schüsse, die schon in Abgabefolge der ganzen Karte stehen */
function intervals(ordered: readonly MetricShot[], numbers: Map<MetricShot, number>): Interval[] {
  const steps = stepsInOrder(ordered)
  return steps.map((step, i) => {
    const before = steps[i - 1]?.shot
    const now = step.shot.firedAtMs
    const then = before?.firedAtMs
    const gap =
      !step.gapBefore && Number.isFinite(now) && Number.isFinite(then)
        ? (now as number) - (then as number)
        : Number.NaN
    return {
      shot: step.shot,
      number: numbers.get(step.shot) as number,
      intervalMs: gap >= 0 ? gap : null,
    }
  })
}

// Erst die ganze Karte ordnen, dann auswählen: dieselbe Reihenfolge wie `shotNumbers`
const timed = (shots: readonly MetricShot[]) => selectShots(inShotOrder(shots), { need: "time" })

/** Streuung des Tempos: IQR der Intervalle ohne Pausen, auch relativ zum Median; ab drei Intervallen */
export function tempoSpread(
  shots: readonly MetricShot[]
): { n: number; iqrMs: number; medianMs: number; relative: number | null } | null {
  const pace = tempo(timesInOrder(timed(shots)))
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

export interface PauseEffect {
  /** Nummer des ersten Wertungsschusses nach der Pause */
  afterShot: number
  /**
   * Ø der bis zu drei Schüsse danach minus Ø der übrigen Schüsse, in Ringen der gewählten Wertung;
   * null, wenn es keine übrigen gibt
   */
  deltaRings: number | null
}

/**
 * Pausen und Wiedereinstieg (Z4), über die Wertungsschüsse mit Zeit und Wert. Verglichen wird mit den
 * übrigen Schüssen, nicht mit der ganzen Scheibe, die die Schüsse nach der Pause selbst enthielte.
 */
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
  const selected = selectShots(inShotOrder(shots), { kinds: MATCH, need: "time" }).filter((shot) =>
    withValue.has(shot)
  )
  if (selected.length === 0) return null
  const steps = intervals(selected, shotNumbers(shots))
  const values = steps.map((step) => valueTenths(step.shot, scoring))
  const meanOf = (list: readonly number[]) => list.reduce((sum, v) => sum + v, 0) / list.length
  const effects: PauseEffect[] = []
  let totalPauseMs = 0
  steps.forEach((step, i) => {
    if (step.intervalMs === null || step.intervalMs <= PAUSE_THRESHOLD_MS) return
    totalPauseMs += step.intervalMs
    const next = values.slice(i, i + 3)
    const rest = [...values.slice(0, i), ...values.slice(i + 3)]
    effects.push({
      afterShot: step.number,
      deltaRings: rest.length ? (meanOf(next) - meanOf(rest)) / 10 : null,
    })
  })
  const deltas = effects.flatMap((e) => (e.deltaRings === null ? [] : [e.deltaRings]))
  return {
    pauses: effects.length,
    totalPauseMs,
    effects,
    meanDelta: deltas.length ? meanOf(deltas) : null,
  }
}

export interface RhythmPoint {
  /** Nummer in der Abgabefolge seiner Art (`shotNumbers`) */
  number: number
  kind: ShotKind
  intervalMs: number | null
  pause: boolean
  /** Median der letzten bis zu `window` Intervalle ohne Pausen bis zu diesem Schuss */
  medianMs: number | null
}

/** Rhythmus-Profil über die Schussnummer (Z5) */
export function rhythmProfile(shots: readonly MetricShot[], window = 5): RhythmPoint[] {
  if (!(Number.isInteger(window) && window >= 1)) {
    throw new RangeError(`Fenster ${window} ist keine ganze Zahl ab 1`)
  }
  const recent: number[] = []
  return intervals(timed(shots), shotNumbers(shots)).map((step) => {
    const pause = step.intervalMs !== null && step.intervalMs > PAUSE_THRESHOLD_MS
    if (step.intervalMs !== null && !pause) {
      recent.push(step.intervalMs)
      if (recent.length > window) recent.shift()
    }
    return {
      number: step.number,
      kind: step.shot.kind,
      intervalMs: step.intervalMs,
      pause,
      medianMs: median(recent),
    }
  })
}
