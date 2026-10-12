import type { Scoring } from "@vereinsheim/shot-core/metrics"

// Die Wertung einer Scheibe und einer Familie (Plan `plans/2026-10-12-spiegel-wertung.md`, User, 12. Oktober 2026):
// Statt einer Wertung des Geräts hat jede Scheibe ihre (gewählt, sonst wie am Stand bzw. amtlich) und jede Familie ihre
// für die Schnitte (gespeichert, sonst die häufigste ihrer Scheiben). Reine Funktionen.

/** Anzeigeart am Monitor (`Treffer.Wertung`, [[meyton-ssmdb2]]): 1 und 7 Zehntel, 2 und 8 ganze Ringe */
const SCORING_OF_MODE: Readonly<Record<number, Scoring>> = {
  1: "decimal",
  7: "decimal",
  2: "rings",
  8: "rings",
}

/**
 * Wie am Stand: die Anzeigeart der Schüsse wie am Ausdruck (mit Wertung nur die Wertung, sonst die Probe), die häufigste
 * von Zehntel und ganzen Ringen, bei Gleichstand die des letzten Schusses in Abgabefolge. Andere Codes (Teiler,
 * verdeckt, …) sagen nichts über die Wertung; ohne einen davon null.
 */
export function standScoringOf(
  shots: readonly { seq: number; stellung: number; displayMode: number | null }[]
): Scoring | null {
  const match = shots.filter((shot) => shot.stellung !== 0)
  const printed = [...(match.length ? match : shots)].sort((a, b) => a.seq - b.seq)
  const scorings = printed.flatMap((shot) => {
    const scoring = shot.displayMode === null ? undefined : SCORING_OF_MODE[shot.displayMode]
    return scoring ? [scoring] : []
  })
  if (!scorings.length) return null
  const rings = scorings.filter((s) => s === "rings").length
  const decimal = scorings.length - rings
  if (rings !== decimal) return rings > decimal ? "rings" : "decimal"
  return scorings.at(-1) as Scoring
}

/**
 * Die Wertung einer Scheibe: gewählt, sonst die Vorgabe. Wettkampf in der amtlichen Wertung der Disziplin (so druckt
 * Meyton), sonst wie am Stand; Training wie am Stand, sonst amtlich; ohne beides Zehntel.
 */
export function cardScoring(card: {
  kind: "training" | "competition"
  official: Scoring | null
  stand: Scoring | null
  choice: Scoring | null
}): Scoring {
  const preset =
    card.kind === "competition" ? (card.official ?? card.stand) : (card.stand ?? card.official)
  return card.choice ?? preset ?? "decimal"
}

/** Die Wertung einer Familie für ihre Schnitte: gespeichert, sonst die häufigste ihrer Scheiben, bei Gleichstand Zehntel */
export function familyScoringOf(cardScorings: readonly Scoring[], saved: Scoring | null): Scoring {
  if (saved) return saved
  const rings = cardScorings.filter((s) => s === "rings").length
  return rings > cardScorings.length - rings ? "rings" : "decimal"
}
