// Einschießen beim Lesen: Abend und Familie für die Regel des Fachkerns (`warmupIds`, SF-05). Der Fachkern kennt keine
// Zeitzonen; der Abend ist `eveningDay` in der Anzeige-Zone.

import { warmupIds } from "@vereinsheim/shot-core/analysis"
import type { ProjectedCard } from "@vereinsheim/shot-core/projection"

import { eveningDay } from "./calendar"

/** der Grund am „–“, wo Einschießen nicht zählt (Liste, Fortschritt, Ablesung) */
export const WARMUP_REASON = "Einschießen zählt nicht"

/**
 * Setzt `warmup` an jeder Scheibe, die Einschießen ist (`warmupIds`), und nimmt es an allen anderen weg; die Folge
 * bleibt. Der Abend ist `eveningDay` in `timeZone`. Eine Scheibe ohne Familie ist nie Einschießen und macht keins.
 */
export function markWarmup<T extends ProjectedCard>(
  cards: readonly T[],
  options: { timeZone: string; familyOf: (card: T) => string | null }
): T[] {
  const ids = warmupIds(
    cards.flatMap((card) => {
      const family = options.familyOf(card)
      if (family === null) return []
      return [
        {
          id: card.id,
          startedAtMs: card.startedAtMs,
          evening: eveningDay(card.startedAtMs, options.timeZone),
          family,
          probeOnly: card.projection.probeOnly,
        },
      ]
    })
  )
  return cards.map(({ warmup: _, ...card }) =>
    ids.has(card.id) ? ({ ...card, warmup: true } as T) : (card as T)
  )
}
