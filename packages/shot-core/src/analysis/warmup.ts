// Einschießen (SF-05): Probe vor einer Wertung desselben Abends zählt in den Übersichten nicht, ein Training ganz im
// Probe-Modus schon. Rein: Abend und Familie bestimmt der Aufrufer (`markWarmup` in `shot-ui`).

/** eine Scheibe, wie die Regel sie braucht: ihr Beginn, ihr Abend (ISO-Tag), ihre Familie und ob sie nur aus Probe besteht */
export interface WarmupCandidate {
  id: string
  startedAtMs: number
  evening: string
  family: string
  probeOnly: boolean
}

/**
 * Die Scheiben, die Einschießen sind: nur Probe, begonnen vor einer Scheibe derselben Familie am selben Abend, die nicht
 * nur Probe ist (auch eine ohne Werte, die auf die Anlage wartet). Probe nach der letzten Wertung des Abends zählt wie
 * ein Training. Die Folge der Eingabe zählt nicht.
 */
export function warmupIds(cards: readonly WarmupCandidate[]): Set<string> {
  const key = (card: WarmupCandidate) => `${card.family}\u0000${card.evening}`
  // je Familie und Abend der Beginn der letzten Wertung
  const lastScored = new Map<string, number>()
  for (const card of cards) {
    if (card.probeOnly) continue
    const k = key(card)
    lastScored.set(k, Math.max(lastScored.get(k) ?? -Infinity, card.startedAtMs))
  }
  return new Set(
    cards
      .filter(
        (card) => card.probeOnly && card.startedAtMs < (lastScored.get(key(card)) ?? -Infinity)
      )
      .map((card) => card.id)
  )
}
