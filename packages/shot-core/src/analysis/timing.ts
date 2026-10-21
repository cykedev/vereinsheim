// Zeit und Rhythmus: Tempo-Konstanz, Wiedereinstieg nach Pausen und ein Rhythmus-Profil über die
// Schussnummer (Katalog Z2, Z4, Z5); die Dauer (Z3) liefert die Registry (`time.duration`). Zeiten
// in Abgabefolge; fehlt ein Schuss oder springt die Uhr zurück, zählt der Abstand nicht (SF-30). Eine
// Probe zwischen zwei Wertungsschüssen ist keine Lücke, wenn die ganze Karte mitkommt (`card`, SF-04).
// Pause ist ein Abstand deutlich länger als der Takt der Karte (`time.ts`: über dem Doppelten des Medians, mindestens
// eine Minute, über drei Minuten immer); alle Auswertungen nehmen dieselbe Schwelle der Karte (`pauseThresholdOf`).

import {
  contextOf,
  inShotOrder,
  intervalsInOrder,
  pauseRuleOf,
  pauseThresholdOf,
  selectShots,
  shotNumbers,
  timesInOrder,
  type MetricShot,
  type Scoring,
  type ShotContext,
  type ShotInterval,
  type ShotKind,
} from "../metrics"
import { iqr, median, permutationMeanTest } from "../stats"
import { tempo, type PauseRule } from "../time"
import { valueNeed, valueTenths } from "./values"

const MATCH: readonly ShotKind[] = ["match"]

interface Interval extends ShotInterval {
  /** Nummer in der Abgabefolge seiner Art über alle gegebenen Schüsse (`shotNumbers`) */
  number: number
}

/** Abstände über Schüsse, die schon in Abgabefolge der ganzen Karte stehen, mit ihrer Nummer */
function intervals(
  ordered: readonly MetricShot[],
  numbers: Map<MetricShot, number>,
  context?: ShotContext
): Interval[] {
  return intervalsInOrder(ordered, context).map((step) => ({
    ...step,
    number: numbers.get(step.shot) as number,
  }))
}

// Erst die ganze Karte ordnen, dann auswählen: dieselbe Reihenfolge wie `shotNumbers`
const timed = (shots: readonly MetricShot[]) => selectShots(inShotOrder(shots), { need: "time" })

/**
 * Streuung des Tempos: IQR der Intervalle ohne Pausen, auch relativ zum Median; ab drei Intervallen.
 * `card`: die ganze Karte, aus der `shots` stammen (SF-04).
 */
export function tempoSpread(
  shots: readonly MetricShot[],
  card: readonly MetricShot[] = shots
): { n: number; iqrMs: number; medianMs: number; relative: number | null } | null {
  const context = contextOf(shots, card)
  const pace = tempo(timesInOrder(timed(shots), context), pauseThresholdOf(shots, context))
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
   * Ø der bis zu drei Schüsse danach minus Ø der übrigen Schüsse, je Schuss in Ringen der gewählten
   * Wertung, beides nur über Schüsse mit Wert; null, wenn eine Seite keinen hat
   */
  deltaRings: number | null
  /**
   * „klar“ nach dem exakten Permutationstest auf den Unterschied der Mittel (zweiseitig), Grenze 0,05 geteilt durch
   * die Zahl der Pausen der Karte (Bonferroni), damit viele Pausen nicht öfter zufällig „klar“ zeigen
   */
  clear: boolean
  /** Richtung nach der Pause, nur wenn klar: besser („up“) oder schwächer („down“) als die übrigen */
  direction: "up" | "down" | null
}

/**
 * Pausen und Wiedereinstieg (Z4). Die Pausen kommen aus den Wertungsschüssen mit Zeit, wie im Rhythmus
 * (Z5): Fehlt einem Schuss nur der Wert, bleibt die Pause (Grenzfall SF-18).
 * Die Schnitte davor und danach zählen nur Schüsse mit Wert; ohne solche ist die Wirkung null. Verglichen
 * wird mit den übrigen Schüssen, nicht mit der ganzen Scheibe, die die Schüsse nach der Pause selbst
 * enthielte. `card`: die ganze Karte, aus der `shots` stammen; eine Probe zwischen zwei Wertungsschüssen
 * ist keine Lücke, die Pause gilt von Wertungsschuss zu Wertungsschuss (SF-04). Das Urteil je Pause rechnet in
 * Zehnteln als ganzen Zahlen: Vorzeichen und „genau 0“ ohne Rundungsfehler, das Urteil in Richtung der Zahl.
 */
export function pauseRecovery(
  shots: readonly MetricShot[],
  scoring: Scoring,
  card: readonly MetricShot[] = shots
): {
  pauses: number
  totalPauseMs: number
  /** was als Pause gilt: Schwelle, üblicher Abstand und Grundlage, aus dem Takt der Karte */
  rule: PauseRule
  effects: PauseEffect[]
  meanDelta: number | null
} | null {
  const withValue = new Set(selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) }))
  const selected = selectShots(inShotOrder(shots), { kinds: MATCH, need: "time" })
  // eine Pause braucht einen Abstand, also zwei Schüsse mit Zeit
  if (selected.length < 2) return null
  const context = { card, kinds: MATCH }
  const rule = pauseRuleOf(selected, context)
  const steps = intervals(selected, shotNumbers(shots), context)
  const values = steps.map((step) =>
    withValue.has(step.shot) ? valueTenths(step.shot, scoring) : null
  )
  const valued = (list: readonly (number | null)[]) => list.filter((v): v is number => v !== null)
  const meanOf = (list: readonly number[]) => list.reduce((sum, v) => sum + v, 0) / list.length
  const sumOf = (list: readonly number[]) => list.reduce((sum, v) => sum + v, 0)
  const found: { afterShot: number; deltaRings: number | null; cross: number; p: number | null }[] =
    []
  let totalPauseMs = 0
  // ohne einen messbaren Abstand (Lücken, Rücksprung der Uhr) weder Pause noch „keine Pause“
  if (steps.every((step) => step.intervalMs === null)) return null
  steps.forEach((step, i) => {
    if (step.intervalMs === null || step.intervalMs <= rule.thresholdMs) return
    totalPauseMs += step.intervalMs
    const next = valued(values.slice(i, i + 3))
    const rest = valued([...values.slice(0, i), ...values.slice(i + 3)])
    if (!next.length || !rest.length) {
      found.push({ afterShot: step.number, deltaRings: null, cross: 0, p: null })
      return
    }
    // Vorzeichen des Unterschieds der Mittel, ganzzahlig: Ø danach gegen Ø der übrigen
    const cross = rest.length * sumOf(next) - next.length * sumOf(rest)
    found.push({
      afterShot: step.number,
      deltaRings: cross === 0 ? 0 : (meanOf(next) - meanOf(rest)) / 10,
      cross,
      p: permutationMeanTest(next, rest)?.p ?? null,
    })
  })
  const alpha = 0.05 / Math.max(1, found.length)
  const effects: PauseEffect[] = found.map(({ afterShot, deltaRings, cross, p }) => {
    const clear = p !== null && p < alpha && cross !== 0
    return { afterShot, deltaRings, clear, direction: clear ? (cross > 0 ? "up" : "down") : null }
  })
  const deltas = effects.flatMap((e) => (e.deltaRings === null ? [] : [e.deltaRings]))
  return {
    pauses: effects.length,
    totalPauseMs,
    rule,
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

/** Rhythmus-Profil über die Schussnummer (Z5); `card`: die ganze Karte, aus der `shots` stammen (SF-04) */
export function rhythmProfile(
  shots: readonly MetricShot[],
  window = 5,
  card: readonly MetricShot[] = shots
): RhythmPoint[] {
  if (!(Number.isInteger(window) && window >= 1)) {
    throw new RangeError(`Fenster ${window} ist keine ganze Zahl ab 1`)
  }
  const recent: number[] = []
  const context = contextOf(shots, card)
  const thresholdMs = pauseThresholdOf(shots, context)
  return intervals(timed(shots), shotNumbers(shots), context).map((step) => {
    const pause = step.intervalMs !== null && step.intervalMs > thresholdMs
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
