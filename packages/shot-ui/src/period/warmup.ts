// Einschießen beim Lesen: Abend und Familie für die Regel des Fachkerns (`warmupIds`, SF-05). Der Fachkern kennt keine
// Zeitzonen; der Abend ist `eveningDay` in der Anzeige-Zone.

import { warmupIds } from "@vereinsheim/shot-core/analysis"
import type { ProjectedCard } from "@vereinsheim/shot-core/projection"

import type { CardProvenance } from "../detail"

import { eveningDay } from "./calendar"

/** der Grund am „–“, wo Einschießen nicht zählt (Liste, Fortschritt, Ablesung) */
export const WARMUP_REASON = "Einschießen zählt nicht"

/** was `markWarmup` über eine Scheibe liest; Herkunft, Warten und Uhrzeit liefert die App (Spiegel: `OverviewCard`) */
export type WarmupCard = ProjectedCard & {
  provenance?: CardProvenance
  waiting?: false
  timeUnknown?: true
}

/**
 * Die Rolle einer Scheibe in der Regel: nur Probe (mit Schuss), Wertung (mit Wertungsschuss oder vom Ausdruck und wartet
 * noch auf die Anlage) oder keine. Eine Scheibe ohne bekannte Uhrzeit hat keine: Ihre 12 Uhr sind ein Platzhalter. Ein
 * leerer Stand und ein Ausdruck, der nicht mehr wartet, machen kein Einschießen.
 */
function roleOf(card: WarmupCard): "probe" | "scored" | null {
  if (card.timeUnknown) return null
  const { probeOnly, printedShots } = card.projection
  if (printedShots > 0) return probeOnly ? "probe" : "scored"
  return card.provenance === "printout" && card.waiting !== false ? "scored" : null
}

/**
 * Setzt `warmup` an jeder Scheibe, die Einschießen ist (`warmupIds`), und nimmt es an allen anderen weg; die Folge
 * bleibt. Der Abend ist `eveningDay` in `timeZone`. Eine Scheibe ohne Familie oder ohne Rolle (`roleOf`) ist nie
 * Einschießen und macht keins.
 */
export function markWarmup<T extends WarmupCard>(
  cards: readonly T[],
  options: { timeZone: string; familyOf: (card: T) => string | null }
): T[] {
  const ids = warmupIds(
    cards.flatMap((card) => {
      const family = options.familyOf(card)
      const role = roleOf(card)
      if (family === null || role === null) return []
      return [
        {
          id: card.id,
          startedAtMs: card.startedAtMs,
          evening: eveningDay(card.startedAtMs, options.timeZone),
          family,
          probeOnly: role === "probe",
        },
      ]
    })
  )
  return cards.map(({ warmup: _, ...card }) =>
    ids.has(card.id) ? ({ ...card, warmup: true } as T) : (card as T)
  )
}
