// Wege zwischen den Seiten (Plan N1, D6, D7): Scheibe öffnen, zurück, blättern und die Querverweise zwischen
// Liste und Fortschritt. Reine Funktionen über Routen; die Seiten bauen ihre Links nur hierüber.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { PeriodSection } from "../layout/sections"
import { resolveRange, type NamedPeriod } from "../period/calendar"
import type { PeriodState } from "../period/state"

import {
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  type CardOrigin,
  type CardRoute,
  type ListQuery,
  type ListRoute,
  type ProgressRoute,
  type Route,
} from "./routes"

/**
 * Die Scheibe `id`, geöffnet von `from`: Die Liste und der Fortschritt geben ihren Zustand mit, der Fortschritt ohne
 * Wahl (das ist die Scheibe selbst) und ohne Wertung. Von anderen Seiten keine Herkunft. Ohne `scoring` öffnet die
 * Scheibe in ihrer Wertung; nur ein Rekord gibt seine mit (Plan `plans/2026-10-12-spiegel-wertung.md`).
 */
export function openCard(from: Route, id: string, scoring: Scoring | null = null): CardRoute {
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
    scoring,
    anchor: null,
  }
}

/**
 * Wohin „Zurück“ führt: in den Fortschritt mit dieser Scheibe gewählt, in die Liste (ohne Sprung zum Abend), nach
 * Start; von einem direkten Link in die Liste. Die Wertung der Scheibe bleibt bei ihr: Der Fortschritt rechnet in der
 * Wertung der Familie, seine Adresse trägt keine.
 */
export function backRoute(card: CardRoute): Route {
  const origin = card.origin
  if (!origin) return { page: "cards", query: DEFAULT_LIST, evening: null }
  if (origin.from === "start") return { page: "start" }
  // zurück in die Liste: die Scheibe ist dort markiert (Rückmeldung des Users, 12. Oktober 2026)
  if (origin.from === "list")
    return { page: "cards", query: origin.query, evening: null, pick: card.id }
  return {
    page: "progress",
    query: { ...origin.query, scoring: DEFAULT_PROGRESS.scoring, chosen: card.id },
    section: null,
  }
}

/**
 * die vorige oder nächste Scheibe im selben Kontext: Herkunft und Abschnitt bleiben (D6); der Reiter der Analyse nicht,
 * eine Scheibe beginnt mit dem ersten (User, 9. Oktober 2026), und in ihrer Wertung
 */
export function siblingRoute(card: CardRoute, id: string): CardRoute {
  return {
    ...card,
    id,
    selection: null,
    shot: null,
    scoring: null,
    anchor: card.anchor ? { section: card.anchor.section } : null,
  }
}

/** „Alle in Scheiben zeigen“ (D7): Familie, Art und Zeitraum des Fortschritts; „Alles“ ist die ganze Liste */
export function listFromProgress(progress: ProgressRoute): ListRoute {
  const { family, kind, choice, chosen } = progress.query
  return {
    page: "cards",
    query: { family, kind, flag: null, range: choice.type === "all" ? null : choice },
    evening: null,
    // die Wahl des Fortschritts ist in der Liste markiert
    ...(chosen ? { pick: chosen } : {}),
  }
}

/**
 * Ein Mischabend (D3): die andere Familie an diesem Abend. Der Hinweis zählt ohne Art und Merkmal, deshalb fallen
 * beide hier weg; der Zeitraum bleibt, der Hinweis zählt nur in ihm. So steht der Abend sicher in der Liste.
 */
export function listOnEvening(query: ListQuery, family: string, day: string): ListRoute {
  return { page: "cards", query: { ...query, family, kind: "all", flag: null }, evening: day }
}

/**
 * „Im Fortschritt zeigen“ im Blatt „Filter“ der Liste (D7, U5): Familie, Art und Zeitraum der Liste; ohne Zeitraum „Alles“. Die Liste hat keine
 * Wertung; es gilt die des Geräts wie bei `openCard`.
 */
export function progressFromList(list: ListRoute, scoring: Scoring = "decimal"): ProgressRoute {
  const { family, kind, range } = list.query
  return {
    page: "progress",
    query: { ...DEFAULT_PROGRESS, family, kind, scoring, choice: range ?? { type: "all" } },
    section: null,
  }
}

/**
 * Name des Rückwegs (D8): „Start“, „Scheiben“ oder der Zeitraum wie in der Seite eines Zeitraums („Letzte 90 Tage“,
 * „Neue Munition“, „01.05.2026 – 30.06.2026“). Der Name hängt nicht von „jetzt“ ab; benannte Zeiträume und die
 * Anzeige-Zeitzone kommen von der Seite.
 */
export function backLabel(
  card: CardRoute,
  context: { named: readonly NamedPeriod[]; timeZone: string }
): string {
  const origin = card.origin
  if (origin?.from === "start") return "Start"
  if (origin?.from !== "progress") return "Scheiben"
  return resolveRange(origin.query.choice, { ...context, nowMs: 0, firstMs: null }).label
}

/** der Zustand der Seite eines Zeitraums als Route; der Abschnitt wird der Anker */
export function progressRoute(state: PeriodState, section: PeriodSection | null): ProgressRoute {
  return { page: "progress", query: { ...state }, section }
}

/** der Zustand der Seite eines Zeitraums aus ihrer Route; ohne Familie die zuletzt benutzte */
export function periodStateFromRoute(route: ProgressRoute, fallbackFamily: string): PeriodState {
  return { ...route.query, family: route.query.family ?? fallbackFamily }
}
