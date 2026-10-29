// Je Einheit aus Treffsicher: neue Scheibe, vorhandene oder keine ([[spiegel-account-transfer]], [[adr-033]] Stufe 3).
// Rein; die Scheiben des Abends in der Familie liest der Lauf über `resultCards`, ohne die eigenen übernommenen.

import type { CardTotals } from "@/lib/results-read"

export type TreffsicherSessionType = "TRAINING" | "WETTKAMPF" | "TROCKENTRAINING" | "MENTAL"

export type CardDecision =
  /** eine passende vorhandene Scheibe (oder mehrere): verknüpfen, keine neue */
  | { kind: "existing"; cardIds: string[] }
  /** keine Scheibe am Abend in der Familie */
  | { kind: "new" }
  /** gewertete Scheiben am Abend, keine passt: trotzdem neu (beide behalten), im Bericht */
  | { kind: "uncertain"; others: { cardId: string; shots: number; total: number | null }[] }
  /** nur Scheiben „nur Probe“ am Abend: keine neue */
  | { kind: "probeEvening"; cardIds: string[] }
  | { kind: "none"; reason: "notShooting" | "noResult" }

/** eine Scheibe des Abends in der Familie der Einheit */
export interface EveningCard {
  id: string
  probeOnly: boolean
  shots: number
  totals: CardTotals
}

/**
 * Die Entscheidung für eine Einheit, in dieser Folge: ohne Schießen oder ohne Angaben keine; ohne Scheibe am Abend neu;
 * passende (nicht nur Probe, gleiche Schusszahl, gleiches Gesamtergebnis in der Wertung von Treffsicher) verknüpfen;
 * nur Probe am Abend keine; sonst neu und unsicher. Ohne Gesamtergebnis in Treffsicher passt keine.
 */
export function decideCard(
  session: { type: TreffsicherSessionType; scoring: "WHOLE" | "TENTH" },
  details: { shots: number; total: { rings?: number; decimalTenths?: number } | null } | null,
  evening: readonly EveningCard[]
): CardDecision {
  if (session.type !== "TRAINING" && session.type !== "WETTKAMPF")
    return { kind: "none", reason: "notShooting" }
  if (!details) return { kind: "none", reason: "noResult" }
  if (!evening.length) return { kind: "new" }
  const whole = session.scoring === "WHOLE"
  const totalOf = (totals: CardTotals) => (whole ? totals.rings : totals.decimalTenths)
  const wanted = details.total ? (whole ? details.total.rings : details.total.decimalTenths) : null
  const scored = evening.filter((card) => !card.probeOnly)
  const fitting = scored.filter(
    (card) =>
      wanted !== null &&
      wanted !== undefined &&
      card.shots === details.shots &&
      totalOf(card.totals) === wanted
  )
  if (fitting.length) return { kind: "existing", cardIds: fitting.map((card) => card.id) }
  if (!scored.length) return { kind: "probeEvening", cardIds: evening.map((card) => card.id) }
  return {
    kind: "uncertain",
    others: scored.map((card) => ({
      cardId: card.id,
      shots: card.shots,
      total: totalOf(card.totals),
    })),
  }
}
