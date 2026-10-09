// Blättern im Kontext (Plan N3, D5; `vault/spiegel/spiegel-navigation.md`, Entscheidung 9): die Scheiben, durch
// die „‹ vorige · nächste ›“ blättert, in zeitlicher Folge. Reine Funktionen über die Modelle der Liste und des
// Fortschritts, damit die Folge genau die ist, aus der man kam.

import { cardListModel, eveningDay, type ListInputCard } from "../list/evenings"
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
 * Ohne Herkunft null: dort gibt es kein Blättern.
 */
export function contextCardIds(card: CardRoute, input: ContextInput): string[] | null {
  const origin = card.origin
  // ohne Familie in der Herkunft die der Scheibe selbst: nur sie enthält die Scheibe sicher (Review N3)
  const own = input.cards.find((c) => c.card.id === card.id)?.family ?? input.cards[0]?.family
  if (origin?.from === "list") {
    const query = { ...origin.query, family: origin.query.family ?? own ?? null }
    const model = cardListModel(input.cards, query, {
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
    const state = periodStateFromRoute(back, own ?? "")
    const model = periodModel({
      cards: input.cards.filter((c) => c.family === state.family).map((c) => c.card),
      state: { ...state, chosen: null },
      nowMs: input.nowMs,
      timeZone: input.timeZone,
      named: input.named,
    })
    return model.cards.map((c) => c.id)
  }
  if (origin?.from === "start") {
    // Start zeigt den letzten Abend: geblättert wird durch seine Scheiben, über alle Familien (Plan N5, D8)
    const sorted = input.cards.map((c) => c.card).sort(byStart)
    const newest = sorted.at(-1)
    if (!newest) return null
    const day = eveningDay(newest.startedAtMs, input.timeZone)
    return sorted.filter((c) => eveningDay(c.startedAtMs, input.timeZone) === day).map((c) => c.id)
  }
  return null
}
