import { describe, expect, it } from "vitest"

import type { ListInputCard } from "../list/evenings"
import { NOW, periodCard, projected, TZ } from "../period/testSeason"
import { contextCardIds, neighbours } from "./context"
import { DEFAULT_LIST, DEFAULT_PROGRESS, type CardRoute, type ListQuery } from "./routes"

/** eine Scheibe mit Projektion, wie Liste und Fortschritt sie nehmen */
const card_ = (...args: Parameters<typeof periodCard>) => projected(periodCard(...args))

// Luftgewehr vom 22. bis 27. September (12:00 MESZ), Training und Wettkampf gemischt, dazu eine Luftpistole
const INPUT: ListInputCard[] = [
  { card: card_("t1", 8, [100]), family: "lg-freihand" },
  { card: card_("w1", 7, [101], { kind: "competition" }), family: "lg-freihand" },
  { card: card_("t2", 6, [102]), family: "lg-freihand" },
  { card: card_("w2", 5, [99], { kind: "competition" }), family: "lg-freihand" },
  { card: card_("w3", 4, [100], { kind: "competition" }), family: "lg-freihand" },
  { card: card_("t3", 3, [98]), family: "lg-freihand" },
  { card: card_("p1", 5, [95]), family: "lp-freihand" },
]
const context = { cards: INPUT, nowMs: NOW, timeZone: TZ, named: [] }
const card = (id: string, origin: CardRoute["origin"]): CardRoute => ({
  page: "card",
  id,
  origin,
  selection: null,
  shot: null,
  scoring: null,
  anchor: null,
})
const fromList = (patch: Partial<ListQuery>): CardRoute["origin"] => ({
  from: "list",
  query: { ...DEFAULT_LIST, family: "lg-freihand", ...patch },
})

describe("Blättern im Kontext", () => {
  it("vorige ist die ältere, nächste die neuere; an den Enden und ohne die Scheibe null", () => {
    const ids = ["w1", "w2", "w3"]
    expect(neighbours(ids, "w2")).toEqual({ prev: "w1", next: "w3" })
    expect(neighbours(ids, "w1")).toEqual({ prev: null, next: "w2" })
    expect(neighbours(ids, "w3")).toEqual({ prev: "w2", next: null })
    expect(neighbours(ids, "x")).toEqual({ prev: null, next: null })
  })

  it("aus der Liste mit Filter „Liste“: nur die Scheiben dieser Liste und die Scheibe selbst", () => {
    const RWK = { id: 3, name: "RWK_LP" }
    const listed = INPUT.map((c) =>
      ["w1", "w3", "t3"].includes(c.card.id) ? { ...c, list: RWK } : c
    )
    const withLists = { ...context, cards: listed }
    expect(contextCardIds(card("w3", fromList({ list: RWK.id })), withLists)).toEqual([
      "w1",
      "w3",
      "t3",
    ])
    // die Scheibe selbst gehört dazu, auch ohne die Liste (Art umgestellt, Filter passt nicht mehr)
    expect(contextCardIds(card("t2", fromList({ list: RWK.id })), withLists)).toEqual([
      "w1",
      "t2",
      "w3",
      "t3",
    ])
    // Gegenprobe: ohne Filter alle Scheiben der Familie
    expect(contextCardIds(card("w3", fromList({})), withLists)).toHaveLength(6)
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

  it("eine Familie ohne eigene Scheiben in der Herkunft gilt wie keine: die der Scheibe", () => {
    const pistol: ListInputCard[] = [
      ...INPUT,
      { card: card_("p2", 2, [96]), family: "lp-freihand" },
      { card: card_("p3", 1, [97]), family: "lp-freihand" },
    ]
    const input = { ...context, cards: pistol }
    expect(contextCardIds(card("p2", fromList({ family: "lp-auflage" })), input)).toEqual([
      "p1",
      "p2",
      "p3",
    ])
    const { chosen: _c, scoring: _s, ...query } = { ...DEFAULT_PROGRESS, family: "lp-auflage" }
    expect(
      contextCardIds(
        card("p3", { from: "progress", query: { ...query, choice: { type: "all" } } }),
        input
      )
    ).toEqual(["p1", "p2", "p3"])
  })

  it("ohne Familie in der Herkunft gilt die Familie der Scheibe selbst", () => {
    const pistol: ListInputCard[] = [
      ...INPUT,
      { card: card_("p2", 2, [96]), family: "lp-freihand" },
      { card: card_("p3", 1, [97]), family: "lp-freihand" },
    ]
    const input = { ...context, cards: pistol }
    expect(contextCardIds(card("p2", fromList({ family: null })), input)).toEqual([
      "p1",
      "p2",
      "p3",
    ])
    const { chosen: _c, scoring: _s, ...query } = { ...DEFAULT_PROGRESS, family: null }
    expect(
      contextCardIds(
        card("p2", { from: "progress", query: { ...query, choice: { type: "all" } } }),
        input
      )
    ).toEqual(["p1", "p2", "p3"])
  })

  it("Liste mit Zeitraum und Merkmal: genau ihre Zeilen", () => {
    const flagged: ListInputCard[] = INPUT.map((c) =>
      c.card.id === "w2" || c.card.id === "t3"
        ? { ...c, card: { ...c.card, flags: ["nur-pdf"] } }
        : c
    )
    const input = { ...context, cards: flagged }
    expect(contextCardIds(card("w2", fromList({ flag: "nur-pdf" })), input)).toEqual(["w2", "t3"])
    expect(
      contextCardIds(
        card("t2", fromList({ range: { type: "free", from: "2026-09-23", to: "2026-09-25" } })),
        input
      )
    ).toEqual(["w1", "t2", "w2"])
  })

  it("Fortschritt ohne „nur Probe“: Trainings nur aus Probe bleiben im Kontext, wie in seiner Liste", () => {
    const probe: ListInputCard[] = [
      ...INPUT,
      { card: card_("pp", 2, [95], { probe: true }), family: "lg-freihand" },
    ]
    const {
      chosen: _c,
      scoring: _s,
      ...query
    } = {
      ...DEFAULT_PROGRESS,
      family: "lg-freihand",
      includeProbeOnly: false,
      choice: { type: "all" as const },
    }
    expect(
      contextCardIds(card("t3", { from: "progress", query }), { ...context, cards: probe })
    ).toEqual(["t1", "w1", "t2", "w2", "w3", "t3", "pp"])
  })

  it("die Scheibe selbst bleibt im Kontext, auch wenn sie nicht mehr zum Filter passt (Art umgestellt)", () => {
    // w2 ist ein Wettkampf, geöffnet aus der Liste „Training“: an ihrer Stelle in der zeitlichen Folge
    expect(contextCardIds(card("w2", fromList({ kind: "training" })), context)).toEqual([
      "t1",
      "t2",
      "w2",
      "t3",
    ])
    const {
      chosen: _c,
      scoring: _s,
      ...query
    } = {
      ...DEFAULT_PROGRESS,
      family: "lg-freihand",
      kind: "training" as const,
      choice: { type: "free" as const, from: "2026-09-23", to: "2026-09-26" },
    }
    expect(contextCardIds(card("w2", { from: "progress", query }), context)).toEqual(["t2", "w2"])
    // eine Scheibe, die es nicht gibt, kommt nicht dazu
    expect(contextCardIds(card("x", fromList({ kind: "training" })), context)).toEqual([
      "t1",
      "t2",
      "t3",
    ])
  })

  it("ohne Herkunft kein Blättern", () => {
    expect(contextCardIds(card("w2", null), context)).toBeNull()
  })

  it("von Start: die Scheiben des letzten Abends, alle Familien, in zeitlicher Folge", () => {
    // t3 am 27.09. um 12:00, eine Luftpistole am Abend, ein Luftgewehr um 01:00 danach (zählt zum Abend davor)
    const evening: ListInputCard[] = [
      ...INPUT,
      {
        card: card_("pe", 0, [96], { startedAtMs: Date.UTC(2026, 8, 27, 16) }),
        family: "lp-freihand",
      },
      {
        card: card_("late", 0, [99], { startedAtMs: Date.UTC(2026, 8, 27, 23) }),
        family: "lg-freihand",
      },
    ]
    expect(contextCardIds(card("pe", { from: "start" }), { ...context, cards: evening })).toEqual([
      "t3",
      "pe",
      "late",
    ])
  })
})
