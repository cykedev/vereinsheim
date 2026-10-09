import { describe, expect, it } from "vitest"

import type { ListInputCard } from "../list/evenings"
import { NOW, periodCard, TZ } from "../period/testSeason"
import { contextCardIds, neighbours } from "./context"
import { DEFAULT_LIST, DEFAULT_PROGRESS, type CardRoute, type ListQuery } from "./routes"

// Luftgewehr vom 22. bis 27. September (12:00 MESZ), Training und Wettkampf gemischt, dazu eine Luftpistole
const INPUT: ListInputCard[] = [
  { card: periodCard("t1", 8, [100]), family: "lg-freihand" },
  { card: periodCard("w1", 7, [101], { kind: "competition" }), family: "lg-freihand" },
  { card: periodCard("t2", 6, [102]), family: "lg-freihand" },
  { card: periodCard("w2", 5, [99], { kind: "competition" }), family: "lg-freihand" },
  { card: periodCard("w3", 4, [100], { kind: "competition" }), family: "lg-freihand" },
  { card: periodCard("t3", 3, [98]), family: "lg-freihand" },
  { card: periodCard("p1", 5, [95]), family: "lp-freihand" },
]
const context = { cards: INPUT, nowMs: NOW, timeZone: TZ, named: [] }
const card = (id: string, origin: CardRoute["origin"]): CardRoute => ({
  page: "card",
  id,
  origin,
  selection: null,
  shot: null,
  scoring: "decimal",
  anchor: null,
})
const fromList = (patch: Partial<ListQuery>): CardRoute["origin"] => ({
  from: "list",
  query: { ...DEFAULT_LIST, family: "lg-freihand", ...patch },
})

describe("Blättern im Kontext (Plan N3, D5)", () => {
  it("vorige ist die ältere, nächste die neuere; an den Enden und ohne die Scheibe null", () => {
    const ids = ["w1", "w2", "w3"]
    expect(neighbours(ids, "w2")).toEqual({ prev: "w1", next: "w3" })
    expect(neighbours(ids, "w1")).toEqual({ prev: null, next: "w2" })
    expect(neighbours(ids, "w3")).toEqual({ prev: "w2", next: null })
    expect(neighbours(ids, "x")).toEqual({ prev: null, next: null })
  })

  it("aus der Liste: ihre Scheiben mit den Filtern der Herkunft, in zeitlicher Folge", () => {
    expect(contextCardIds(card("w2", fromList({ kind: "competition" })), context)).toEqual([
      "w1",
      "w2",
      "w3",
    ])
    // Gegenprobe: eine andere Art ergibt andere Nachbarn
    expect(contextCardIds(card("t2", fromList({ kind: "training" })), context)).toEqual([
      "t1",
      "t2",
      "t3",
    ])
    expect(contextCardIds(card("t2", fromList({})), context)).toEqual([
      "t1",
      "w1",
      "t2",
      "w2",
      "w3",
      "t3",
    ])
  })

  it("aus dem Fortschritt: die Scheiben seines Zeitraums nach seinem Zustand", () => {
    const origin = (patch: Partial<typeof DEFAULT_PROGRESS>): CardRoute["origin"] => {
      const {
        chosen: _chosen,
        scoring: _scoring,
        ...query
      } = {
        ...DEFAULT_PROGRESS,
        family: "lg-freihand",
        choice: { type: "free" as const, from: "2026-09-23", to: "2026-09-26" },
        ...patch,
      }
      return { from: "progress", query }
    }
    expect(contextCardIds(card("w2", origin({})), context)).toEqual(["w1", "t2", "w2", "w3"])
    expect(contextCardIds(card("w2", origin({ kind: "competition" })), context)).toEqual([
      "w1",
      "w2",
      "w3",
    ])
    // ohne Familie in der Herkunft die erste der Eingabe
    expect(contextCardIds(card("w2", origin({ family: null })), context)).toEqual([
      "w1",
      "t2",
      "w2",
      "w3",
    ])
  })

  it("ohne Herkunft und von Start: kein Blättern", () => {
    expect(contextCardIds(card("w2", null), context)).toBeNull()
    expect(contextCardIds(card("w2", { from: "start" }), context)).toBeNull()
  })
})
