// Tempo einer Schussfolge: Intervalle, Pausen und Dauer.
//
// Die Zeiten kommen in Abgabefolge, nicht nach der Uhr sortiert (SF-30). Ein Intervall über drei
// Minuten ist eine Pause (Gespräch, Scheibenwechsel, Toilette) und zählt nicht zum Tempo-Median, sonst
// verzerrt eine Pause das Bild (SF-62). Ein negativer Abstand heißt, die Uhr ist zurückgesprungen; er
// zählt weder als Intervall noch als Pause.

export const PAUSE_THRESHOLD_MS = 180_000

export interface Tempo {
  /** Intervalle ohne Pausen, in Abgabefolge */
  intervalsMs: number[]
  pausesMs: number[]
  /** negative Abstände: Rücksprünge der Uhr (SF-30) */
  clockJumps: number
  medianIntervalMs: number | null
  /** 0, wenn es keine Pause gab; null unter zwei Schüssen */
  longestPauseMs: number | null
  /** vom frühesten bis zum spätesten Schuss; null ohne Schuss */
  durationMs: number | null
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** `firedAtMs` in Abgabefolge */
export function tempo(firedAtMs: readonly number[]): Tempo {
  const intervalsMs: number[] = []
  const pausesMs: number[] = []
  let clockJumps = 0
  for (let i = 1; i < firedAtMs.length; i++) {
    const gap = firedAtMs[i] - firedAtMs[i - 1]
    if (gap < 0) clockJumps++
    else if (gap > PAUSE_THRESHOLD_MS) pausesMs.push(gap)
    else intervalsMs.push(gap)
  }
  return {
    intervalsMs,
    pausesMs,
    clockJumps,
    medianIntervalMs: median(intervalsMs),
    longestPauseMs: firedAtMs.length < 2 ? null : Math.max(0, ...pausesMs),
    durationMs: firedAtMs.length === 0 ? null : Math.max(...firedAtMs) - Math.min(...firedAtMs),
  }
}
