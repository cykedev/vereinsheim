// Tempo einer Schussfolge: Intervalle, Pausen und Dauer.
//
// Die Zeiten kommen in Abgabefolge, nicht nach der Uhr sortiert (SF-30). Ein Intervall über drei
// Minuten ist eine Pause (Gespräch, Scheibenwechsel, Toilette) und zählt nicht zum Tempo-Median, sonst
// verzerrt eine Pause das Bild (SF-62). Ein negativer Abstand heißt, die Uhr ist zurückgesprungen; er
// zählt weder als Intervall noch als Pause. `null` markiert eine Lücke (ein Schuss ohne brauchbare
// Zeit): Die Abstände daneben zählen nicht, sonst würden zwei Intervalle zu einer Pause.

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
  /** vom frühesten bis zum spätesten Schuss; null ohne Schuss oder nach einem Sprung der Uhr */
  durationMs: number | null
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const usable = (ms: number | null): ms is number => ms !== null && Number.isFinite(ms)

/** `firedAtMs` in Abgabefolge; `null` (oder eine ungültige Zahl) ist eine Lücke */
export function tempo(firedAtMs: readonly (number | null)[]): Tempo {
  const intervalsMs: number[] = []
  const pausesMs: number[] = []
  let clockJumps = 0
  for (let i = 1; i < firedAtMs.length; i++) {
    const before = firedAtMs[i - 1]
    const after = firedAtMs[i]
    if (!usable(before) || !usable(after)) continue
    const gap = after - before
    if (gap < 0) clockJumps++
    else if (gap > PAUSE_THRESHOLD_MS) pausesMs.push(gap)
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
  }
}
