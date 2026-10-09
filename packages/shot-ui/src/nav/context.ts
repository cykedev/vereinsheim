// Blättern im Kontext (Plan N3, D5; `vault/spiegel/spiegel-navigation.md`, Entscheidung 9): die Scheiben, durch
// die „‹ vorige · nächste ›“ blättert, in zeitlicher Folge. Reine Funktionen über die Modelle der Liste und des
// Fortschritts, damit die Folge genau die ist, aus der man kam.

import { cardListModel, type ListInputCard } from "../list/evenings"
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
 * Herkunft, aus dem Fortschritt die Scheiben seines Zeitraums nach seinem Zustand. Ohne Herkunft und von Start
 * null: dort gibt es kein Blättern (Start kommt mit N5).
 */
export function contextCardIds(card: CardRoute, input: ContextInput): string[] | null {
  const origin = card.origin
  if (origin?.from === "list") {
    const model = cardListModel(input.cards, origin.query, {
      timeZone: input.timeZone,
      nowMs: input.nowMs,
      named: input.named,
      scoring: card.scoring,
    })
    const ids = new Set(model.evenings.flatMap((e) => e.rows.map((r) => r.id)))
    return input.cards
      .map((c) => c.card)
      .filter((c) => ids.has(c.id))
      .sort(byStart)
      .map((c) => c.id)
  }
  if (origin?.from === "progress") {
    const back = backRoute(card)
    if (back.page !== "progress") return null
    // ohne Familie in der Herkunft die erste der Eingabe, wie in `cardListModel`
    const state = periodStateFromRoute(back, input.cards[0]?.family ?? "")
    const model = periodModel({
      cards: input.cards.filter((c) => c.family === state.family).map((c) => c.card),
      state: { ...state, chosen: null },
      nowMs: input.nowMs,
      timeZone: input.timeZone,
      named: input.named,
    })
    return model.cards.map((c) => c.id)
  }
  return null
}
