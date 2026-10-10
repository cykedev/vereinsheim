// Tempo einer Schussfolge: Intervalle, Pausen und Dauer.
//
// Die Zeiten kommen in Abgabefolge, nicht nach der Uhr sortiert (SF-30). Eine Pause zählt nicht zum Tempo-Median,
// sonst verzerrt sie das Bild (SF-62). Pause ist ein Abstand, der deutlich länger ist als der eigene Takt: über dem
// 2,5-Fachen des Medians der Abstände, mindestens eine Minute; über drei Minuten immer (Gespräch, Scheibenwechsel).
// Unter fünf Abständen gibt es keinen eigenen Takt, dann gilt nur die feste Grenze (User, 10. Oktober 2026: an den
// eigenen Scheiben fand die feste Grenze 3 von 906 Abständen, die relative die 10, die dem User auffielen).
// Ein negativer Abstand heißt, die Uhr ist zurückgesprungen; er zählt weder als Intervall noch als Pause. `null`
// markiert eine Lücke (ein Schuss ohne brauchbare Zeit): Die Abstände daneben zählen nicht, sonst würden zwei
// Intervalle zu einer Pause.

/** über drei Minuten ist ein Abstand immer eine Pause */
export const PAUSE_ALWAYS_MS = 180_000
/** deutlich länger als der eigene Takt: über diesem Vielfachen des Medians der Abstände */
export const PAUSE_FACTOR = 2.5
/** darunter keine Pause, auch bei sehr schnellem Takt */
export const PAUSE_MIN_MS = 60_000
/** ab so vielen Abständen (bis drei Minuten) gilt der eigene Takt */
export const PAUSE_MIN_INTERVALS = 5

export interface Tempo {
  /** Intervalle ohne Pausen, in Abgabefolge */
  intervalsMs: number[]
  pausesMs: number[]
  /** negative Abstände: Rücksprünge der Uhr (SF-30) */
  clockJumps: number
  medianIntervalMs: number | null
  /**
   * 0, wenn es keine Pause gab; null unter zwei Schüssen. Keine Kennzahl mehr (Oktober 2026): Die
   * Pausen zeigt Z4 einzeln.
   */
  longestPauseMs: number | null
  /** vom frühesten bis zum spätesten Schuss; null ohne Schuss oder nach einem Sprung der Uhr */
  durationMs: number | null
  /** ab hier (ausschließlich) ist ein Abstand eine Pause */
  pauseThresholdMs: number
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const usable = (ms: number | null): ms is number => ms !== null && Number.isFinite(ms)

/** die Abstände einer Folge in Abgabefolge, ohne Lücken (null) und ohne Rücksprünge der Uhr */
export function gapsOf(firedAtMs: readonly (number | null)[]): number[] {
  const gaps: number[] = []
  for (let i = 1; i < firedAtMs.length; i++) {
    const before = firedAtMs[i - 1]
    const after = firedAtMs[i]
    if (!usable(before) || !usable(after) || after < before) continue
    gaps.push(after - before)
  }
  return gaps
}

/**
 * die Schwelle für eine Pause aus den Abständen einer Schussfolge: das 2,5-Fache des Medians der Abstände bis drei
 * Minuten, mindestens eine, höchstens drei Minuten; unter fünf solchen Abständen drei Minuten
 */
export function pauseThresholdMs(gapsMs: readonly number[]): number {
  const usual = gapsMs.filter((gap) => gap <= PAUSE_ALWAYS_MS)
  if (usual.length < PAUSE_MIN_INTERVALS) return PAUSE_ALWAYS_MS
  const relative = PAUSE_FACTOR * (median(usual) as number)
  return Math.min(PAUSE_ALWAYS_MS, Math.max(PAUSE_MIN_MS, relative))
}

/**
 * `firedAtMs` in Abgabefolge; `null` (oder eine ungültige Zahl) ist eine Lücke. Ohne `thresholdMs` gilt die Schwelle
 * aus dieser Folge selbst; eine Auswahl (eine Serie) gibt die Schwelle ihrer ganzen Karte mit
 */
export function tempo(
  firedAtMs: readonly (number | null)[],
  thresholdMs = pauseThresholdMs(gapsOf(firedAtMs))
): Tempo {
  const intervalsMs: number[] = []
  const pausesMs: number[] = []
  let clockJumps = 0
  for (let i = 1; i < firedAtMs.length; i++) {
    const before = firedAtMs[i - 1]
    const after = firedAtMs[i]
    if (!usable(before) || !usable(after)) continue
    const gap = after - before
    if (gap < 0) clockJumps++
    else if (gap > thresholdMs) pausesMs.push(gap)
    else intervalsMs.push(gap)
  }
  const known = firedAtMs.filter(usable)
  return {
    intervalsMs,
    pausesMs,
    clockJumps,
    medianIntervalMs: median(intervalsMs),
    longestPauseMs: known.length < 2 ? null : Math.max(0, ...pausesMs),
    durationMs:
      known.length === 0 || clockJumps > 0 ? null : Math.max(...known) - Math.min(...known),
    pauseThresholdMs: thresholdMs,
  }
}
