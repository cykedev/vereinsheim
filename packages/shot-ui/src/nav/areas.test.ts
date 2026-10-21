import { describe, expect, it } from "vitest"

import { areaLinks, areaOf, type AreaMemory } from "./areas"
import { DEFAULT_LIST, DEFAULT_PROGRESS, urlFromRoute, type CardRoute, type Route } from "./routes"

const card = (origin: CardRoute["origin"]): CardRoute => ({
  page: "card",
  id: "c1",
  origin,
  selection: null,
  shot: null,
  scoring: "decimal",
  anchor: null,
})

describe("Bereiche der Navigation", () => {
  it("jede Seite gehört zu einem Bereich; die Scheibe zu dem, aus dem sie kam", () => {
    const pages: [Route, ReturnType<typeof areaOf>][] = [
      [{ page: "start" }, "start"],
      [{ page: "open" }, "start"],
      [{ page: "cards", query: DEFAULT_LIST, evening: null }, "cards"],
      [{ page: "progress", query: DEFAULT_PROGRESS, section: null }, "progress"],
      [{ page: "scan" }, "scan"],
      [{ page: "profile" }, "profile"],
      [{ page: "trash" }, "profile"],
      [{ page: "admin", section: null }, "admin"],
      [{ page: "unknown", path: "/x" }, null],
      [card(null), "cards"],
      [card({ from: "list", query: DEFAULT_LIST }), "cards"],
      [card({ from: "start" }), "start"],
      [card({ from: "progress", query: { ...DEFAULT_PROGRESS } }), "progress"],
      [{ page: "compare", query: { type: "cards", a: "a", b: "b" } }, "progress"],
    ]
    for (const [route, area] of pages) expect(areaOf(route), JSON.stringify(route)).toBe(area)
  })

  it("ohne Gedächtnis die Vorgaben mit der Familie", () => {
    const links = areaLinks({ cards: null, progress: null }, "lp-freihand")
    expect(urlFromRoute(links.cards)).toBe("/cards?family=lp-freihand")
    expect(urlFromRoute(links.progress)).toBe("/progress?family=lp-freihand")
    expect(urlFromRoute(links.start)).toBe("/")
    expect(urlFromRoute(links.scan)).toBe("/scan")
    expect(urlFromRoute(links.profile)).toBe("/profile")
    expect(urlFromRoute(links.admin)).toBe("/admin")
  })

  it("mit Gedächtnis die letzte Adresse des Bereichs, mit der zuletzt gewählten Familie, ohne Abend", () => {
    const memory: AreaMemory = {
      cards: {
        page: "cards",
        query: { ...DEFAULT_LIST, family: "lg-freihand", kind: "competition" },
        evening: "2026-09-12",
        // eine markierte Scheibe der Liste fällt beim Wechsel der Bereiche weg, wie der Abend
        pick: "c9",
      },
      progress: {
        page: "progress",
        query: {
          ...DEFAULT_PROGRESS,
          family: "lg-freihand",
          choice: { type: "all" },
          chosen: "c7",
        },
        section: "history",
      },
    }
    const same = areaLinks(memory, "lg-freihand")
    expect(urlFromRoute(same.cards)).toBe("/cards?family=lg-freihand&kind=competition")
    // gleiche Familie: die Wahl bleibt, der Abschnitt nicht
    expect(urlFromRoute(same.progress)).toBe("/progress?range=all&family=lg-freihand&pick=c7")
    const other = areaLinks(memory, "lp-freihand")
    expect(urlFromRoute(other.cards)).toBe("/cards?family=lp-freihand&kind=competition")
    // andere Familie: die Wahl gehört zur alten und fällt weg
    expect(urlFromRoute(other.progress)).toBe("/progress?range=all&family=lp-freihand")
  })

  it("trug die gemerkte Adresse keine Familie, bleibt die Wahl (der Server hat die Familie aufgelöst)", () => {
    const memory: AreaMemory = {
      cards: null,
      progress: {
        page: "progress",
        query: { ...DEFAULT_PROGRESS, family: null, chosen: "c7" },
        section: null,
      },
    }
    expect(urlFromRoute(areaLinks(memory, "lg-freihand").progress)).toBe(
      "/progress?family=lg-freihand&pick=c7"
    )
  })

  it("ohne Familie bleibt die gemerkte", () => {
    const memory: AreaMemory = {
      cards: { page: "cards", query: { ...DEFAULT_LIST, family: "lg-freihand" }, evening: null },
      progress: null,
    }
    expect(urlFromRoute(areaLinks(memory, null).cards)).toBe("/cards?family=lg-freihand")
  })
})
