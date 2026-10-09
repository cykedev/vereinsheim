import { describe, expect, it } from "vitest"

import { backRoute, listFromProgress, openCard, progressFromList, siblingRoute } from "./navigate"
import {
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  urlFromRoute,
  type ListRoute,
  type ProgressRoute,
} from "./routes"

const PROGRESS: ProgressRoute = {
  page: "progress",
  query: {
    ...DEFAULT_PROGRESS,
    choice: { type: "named", id: "neue-munition" },
    compare: { type: "previous" },
    family: "lg-10m",
    kind: "training",
    scoring: "rings",
    metric: "group.sigma",
    chosen: "c3",
  },
  section: "scheiben",
}
const LIST: ListRoute = {
  page: "cards",
  query: { ...DEFAULT_LIST, family: "lp-10m", flag: "nur-pdf" },
  evening: "2026-09-25",
}

describe("Wege zwischen den Seiten (D6, D7)", () => {
  it("aus dem Fortschritt öffnen: Herkunft ohne Wahl und Wertung, die Wertung trägt die Scheibe", () => {
    const card = openCard(PROGRESS, "c42")
    expect(card).toEqual({
      page: "card",
      id: "c42",
      origin: {
        from: "progress",
        query: {
          choice: { type: "named", id: "neue-munition" },
          compare: { type: "previous" },
          family: "lg-10m",
          kind: "training",
          includeProbeOnly: true,
          metric: "group.sigma",
          view: null,
        },
      },
      selection: null,
      shot: null,
      scoring: "rings",
      anchor: null,
    })
    expect(urlFromRoute(card)).toBe(
      "/cards/c42?from=progress&range=neue-munition&compare=previous&family=lg-10m&kind=training&metric=sigma&scoring=rings"
    )
  })

  it("Rundreise: öffnen und zurück ergibt denselben Fortschritt, gewählt ist die Scheibe", () => {
    const back = backRoute(openCard(PROGRESS, "c42"))
    expect(back).toEqual({
      ...PROGRESS,
      query: { ...PROGRESS.query, chosen: "c42" },
      section: null,
    })
    // auf der Scheibe die Wertung gewechselt: sie kommt mit zurück
    const switched = { ...openCard(PROGRESS, "c42"), scoring: "decimal" as const }
    expect(backRoute(switched)).toMatchObject({
      page: "progress",
      query: { scoring: "decimal", chosen: "c42" },
    })
  })

  it("aus der Liste öffnen und zurück ergibt dieselbe Liste; der Abend fällt weg", () => {
    const card = openCard(LIST, "c7")
    expect(card.origin).toEqual({ from: "list", query: LIST.query })
    expect(card.scoring).toBe("decimal")
    expect(backRoute(card)).toEqual({ ...LIST, evening: null })
  })

  it("von Start und als direkter Link; die Wertung des Geräts geht vor, wo die Herkunft keine hat", () => {
    expect(backRoute(openCard({ page: "start" }, "c1"))).toEqual({ page: "start" })
    const direct = openCard({ page: "scan" }, "c1", "rings")
    expect(direct.origin).toBeNull()
    expect(direct.scoring).toBe("rings")
    expect(backRoute(direct)).toEqual({ page: "cards", query: DEFAULT_LIST, evening: null })
  })

  it("Blättern behält Herkunft, Wertung und Abschnitt und verliert Auswahl und Schuss", () => {
    const card = {
      ...openCard(PROGRESS, "c42"),
      selection: 2,
      shot: "23",
      anchor: { section: "analyse", tab: "position" },
    } as const
    expect(siblingRoute(card, "c43")).toEqual({
      ...card,
      id: "c43",
      selection: null,
      shot: null,
    })
  })

  it("Querverweise: Familie, Art und Zeitraum gehen mit; eine Liste ohne Zeitraum wird „Alles“", () => {
    expect(listFromProgress(PROGRESS)).toEqual({
      page: "cards",
      query: {
        family: "lg-10m",
        kind: "training",
        flag: null,
        range: { type: "named", id: "neue-munition" },
      },
      evening: null,
    })
    expect(
      listFromProgress({ ...PROGRESS, query: { ...PROGRESS.query, choice: { type: "all" } } }).query
        .range
    ).toBeNull()
    expect(progressFromList(LIST)).toEqual({
      page: "progress",
      query: { ...DEFAULT_PROGRESS, family: "lp-10m", choice: { type: "all" } },
      section: null,
    })
    expect(
      progressFromList({ ...LIST, query: { ...LIST.query, range: { type: "rolling", days: 30 } } })
        .query.choice
    ).toEqual({ type: "rolling", days: 30 })
  })
})
