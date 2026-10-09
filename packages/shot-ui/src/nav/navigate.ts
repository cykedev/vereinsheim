// Wege zwischen den Seiten (Plan N1, D6, D7): Scheibe öffnen, zurück, blättern und die Querverweise zwischen
// Liste und Fortschritt. Reine Funktionen über Routen; die Seiten bauen ihre Links nur hierüber.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import {
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  type CardOrigin,
  type CardRoute,
  type ListRoute,
  type ProgressRoute,
  type Route,
} from "./routes"

/**
 * Die Scheibe `id`, geöffnet von `from`: Die Liste und der Fortschritt geben ihren Zustand mit, der Fortschritt ohne
 * Wahl (das ist die Scheibe selbst) und ohne Wertung (die trägt die Scheibe, sie übernimmt seine). Von anderen Seiten
 * keine Herkunft; dort gilt `scoring`, die Wertung des Geräts.
 */
export function openCard(from: Route, id: string, scoring: Scoring = "decimal"): CardRoute {
  let origin: CardOrigin = null
  if (from.page === "cards") origin = { from: "list", query: from.query }
  else if (from.page === "start") origin = { from: "start" }
  else if (from.page === "progress") {
    const { chosen: _chosen, scoring: _scoring, ...query } = from.query
    origin = { from: "progress", query }
  }
  return {
    page: "card",
    id,
    origin,
    selection: null,
    shot: null,
    scoring: from.page === "progress" ? from.query.scoring : scoring,
    anchor: null,
  }
}

/**
 * Wohin „Zurück“ führt: in den Fortschritt mit dieser Scheibe gewählt und der Wertung der Scheibe, in die Liste
 * (ohne Sprung zum Abend), nach Start; von einem direkten Link in die Liste.
 */
export function backRoute(card: CardRoute): Route {
  const origin = card.origin
  if (!origin) return { page: "cards", query: DEFAULT_LIST, evening: null }
  if (origin.from === "start") return { page: "start" }
  if (origin.from === "list") return { page: "cards", query: origin.query, evening: null }
  return {
    page: "progress",
    query: { ...origin.query, scoring: card.scoring, chosen: card.id },
    section: null,
  }
}

/** die vorige oder nächste Scheibe im selben Kontext: Herkunft, Wertung und Abschnitt bleiben (D6) */
export function siblingRoute(card: CardRoute, id: string): CardRoute {
  return { ...card, id, selection: null, shot: null }
}

/** „Alle in Scheiben zeigen“ (D7): Familie, Art und Zeitraum des Fortschritts; „Alles“ ist die ganze Liste */
export function listFromProgress(progress: ProgressRoute): ListRoute {
  const { family, kind, choice } = progress.query
  return {
    page: "cards",
    query: { family, kind, flag: null, range: choice.type === "all" ? null : choice },
    evening: null,
  }
}

/** „Verlauf dieser Filter“ (D7): Familie, Art und Zeitraum der Liste; ohne Zeitraum „Alles“ */
export function progressFromList(list: ListRoute): ProgressRoute {
  const { family, kind, range } = list.query
  return {
    page: "progress",
    query: { ...DEFAULT_PROGRESS, family, kind, choice: range ?? { type: "all" } },
    section: null,
  }
}
