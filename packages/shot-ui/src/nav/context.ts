// Blättern im Kontext (Plan N3, D5; `vault/spiegel/spiegel-navigation.md`, Entscheidung 9): die Scheiben, durch
// die „‹ vorige · nächste ›“ blättert, in zeitlicher Folge. Reine Funktionen über die Modelle der Liste und des
// Fortschritts, damit die Folge genau die ist, aus der man kam.

import { cardListModel, lastEvening, type ListInputCard } from "../list/evenings"
import type { NamedPeriod } from "../period/calendar"
import { byStart, periodModel } from "../period/model"
import { backRoute, periodStateFromRoute } from "./navigate"
import type { CardRoute } from "./routes"

/** die Nachbarn in einer zeitlichen Folge: `prev` ist die ältere; ohne die Scheibe in der Folge keine */
export function neighbours(
  ids: readonly string[],
  id: string
): { prev: string | null; next: string | null } {
  const i = ids.indexOf(id)
  if (i < 0) return { prev: null, next: null }
  return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null }
}

export interface ContextInput {
  /** alle Scheiben mit ihrer Familie */
  cards: readonly ListInputCard[]
  nowMs: number
  timeZone: string
  named: readonly NamedPeriod[]
}

/**
 * Die Scheiben des Kontexts einer Scheibe in zeitlicher Folge: aus der Liste ihre Zeilen mit den Filtern der
 * Herkunft, aus dem Fortschritt die Scheiben seines Zeitraums nach seinem Zustand, von Start die des letzten Abends.
 * Die Scheibe selbst gehört immer dazu, an ihrer Stelle: Stellt man ihre Art um, passt sie womöglich nicht mehr zum
 * Filter der Herkunft, und das Blättern risse ab (Review, Plan `plans/2026-10-12-spiegel-art.md`). Ohne Herkunft null:
 * dort gibt es kein Blättern.
 */
export function contextCardIds(card: CardRoute, input: ContextInput): string[] | null {
  const origin = card.origin
  // ohne Familie in der Herkunft die der Scheibe selbst: nur sie enthält die Scheibe sicher (Review N3). Eine Familie ohne
  // eigene Scheiben gilt wie keine; Liste und Fortschritt zeigen dann auch eine andere (Review SP-1.8)
  const own = input.cards.find((c) => c.card.id === card.id)?.family ?? input.cards[0]?.family
  const known = new Set(input.cards.map((c) => c.family))
  const familyOf = (family: string | null) =>
    family !== null && known.has(family) ? family : (own ?? null)
  if (origin?.from === "list") {
    const query = { ...origin.query, family: familyOf(origin.query.family) }
    const model = cardListModel(input.cards, query, {
      timeZone: input.timeZone,
      nowMs: input.nowMs,
      named: input.named,
      // die Wertung ändert nicht, welche Scheiben die Liste zeigt
      scoring: "decimal",
    })
    const ids = new Set(model.evenings.flatMap((e) => e.rows.map((r) => r.id)))
    return input.cards
      .map((c) => c.card)
      .filter((c) => ids.has(c.id) || c.id === card.id)
      .sort(byStart)
      .map((c) => c.id)
  }
  if (origin?.from === "progress") {
    const back = backRoute(card)
    if (back.page !== "progress") return null
    const fromRoute = periodStateFromRoute(back, own ?? "")
    const state = { ...fromRoute, family: familyOf(fromRoute.family) ?? fromRoute.family }
    const model = periodModel({
      cards: input.cards.filter((c) => c.family === state.family).map((c) => c.card),
      state: { ...state, chosen: null },
      nowMs: input.nowMs,
      timeZone: input.timeZone,
      named: input.named,
    })
    const self = input.cards.find((c) => c.card.id === card.id)?.card
    const cards =
      self && !model.cards.some((c) => c.id === self.id) ? [...model.cards, self] : model.cards
    return [...cards].sort(byStart).map((c) => c.id)
  }
  if (origin?.from === "start") {
    // Start zeigt den letzten Abend: geblättert wird durch seine Scheiben, über alle Familien (Plan N5, D8)
    return lastEvening(input.cards, input.timeZone)?.cards.map((c) => c.card.id) ?? null
  }
  return null
}
