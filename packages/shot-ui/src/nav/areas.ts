// Bereiche der Navigation (Plan N3, `vault/spiegel/spiegel-navigation.md`, Entscheidungen 11 und 16): zu welchem
// Bereich eine Seite gehört und wohin die Einträge der Navigation führen. Reine Funktionen.

import {
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  type CardOrigin,
  type ListRoute,
  type ProgressRoute,
  type Route,
} from "./routes"

/** die Bereiche der Navigation; Admin sieht nur ein Admin */
export type Area = "start" | "cards" | "scan" | "progress" | "profile" | "admin"

/** der Bereich einer Herkunft: die Liste und ein direkter Link gehören zu Scheiben */
const originArea = (origin: CardOrigin): Area =>
  origin?.from === "start" ? "start" : origin?.from === "progress" ? "progress" : "cards"

/** der Bereich einer Seite; eine Scheibe und ein Vergleich gehören zu dem, aus dem sie kamen */
export function areaOf(route: Route): Area | null {
  switch (route.page) {
    case "start":
    case "open":
      return "start"
    case "cards":
      return "cards"
    case "progress":
      return "progress"
    case "scan":
      return "scan"
    case "profile":
    case "trash":
      return "profile"
    case "admin":
      return "admin"
    case "card":
    case "compare":
      return originArea(route.origin)
    case "unknown":
      return null
  }
}

/** die letzte Adresse der Bereiche mit Filtern; null: noch nicht besucht */
export interface AreaMemory {
  cards: ListRoute | null
  progress: ProgressRoute | null
}

/**
 * Wohin die Einträge der Navigation führen (D4): Scheiben und Fortschritt zur letzten Adresse des Bereichs, wie
 * Reiter einer App, mit der zuletzt gewählten Familie (User, 9. Oktober 2026); ohne letzte Adresse die Vorgabe
 * mit dieser Familie. Der Abend der Liste und der Abschnitt des Fortschritts fallen weg; wechselt die Familie,
 * auch die Wahl im Fortschritt (sie gehört zur anderen). Ohne Familie bleibt die gemerkte.
 */
export function areaLinks(memory: AreaMemory, family: string | null): Record<Area, Route> {
  const listFamily = family ?? memory.cards?.query.family ?? null
  const progress = memory.progress?.query ?? { ...DEFAULT_PROGRESS }
  const progressFamily = family ?? progress.family
  return {
    start: { page: "start" },
    cards: {
      page: "cards",
      query: { ...(memory.cards?.query ?? DEFAULT_LIST), family: listFamily },
      evening: null,
    },
    scan: { page: "scan" },
    progress: {
      page: "progress",
      query: {
        ...progress,
        family: progressFamily,
        chosen: progressFamily === progress.family ? progress.chosen : null,
      },
      section: null,
    },
    profile: { page: "profile" },
    admin: { page: "admin", section: null },
  }
}
