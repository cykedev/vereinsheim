// Tempo einer Schussfolge: Intervalle, Pausen und Dauer.
//
// Ein Intervall über drei Minuten ist eine Pause (Gespräch, Scheibenwechsel, Toilette) und zählt
// nicht zum Tempo-Median, sonst verzerrt eine Pause das Bild (SF-62).

export const PAUSE_THRESHOLD_MS = 180_000

export interface Tempo {
  /** Intervalle ohne Pausen, in Schussfolge */
  intervalsMs: number[]
  pausesMs: number[]
  medianIntervalMs: number | null
  /** 0, wenn es keine Pause gab; null unter zwei Schüssen */
  longestPauseMs: number | null
  /** vom ersten bis zum letzten Schuss; null ohne Schuss */
  durationMs: number | null
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function tempo(firedAtMs: readonly number[]): Tempo {
  const times = [...firedAtMs].sort((a, b) => a - b)
  const intervalsMs: number[] = []
  const pausesMs: number[] = []
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1]
    if (gap > PAUSE_THRESHOLD_MS) pausesMs.push(gap)
    else intervalsMs.push(gap)
  }
  return {
    intervalsMs,
    pausesMs,
    medianIntervalMs: median(intervalsMs),
    longestPauseMs: times.length < 2 ? null : Math.max(0, ...pausesMs),
    durationMs: times.length === 0 ? null : times[times.length - 1] - times[0],
  }
}
