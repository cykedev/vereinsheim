import { describe, expect, it } from "vitest"

import {
  backLabel,
  backRoute,
  listFromProgress,
  openCard,
  periodStateFromRoute,
  progressFromList,
  progressRoute,
  progressWithMetric,
  siblingRoute,
} from "./navigate"
import { initialPeriodState, periodReducer, type PeriodState } from "../period/state"
import {
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  routeFromHref,
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
  section: "cards",
}
const LIST: ListRoute = {
  page: "cards",
  query: { ...DEFAULT_LIST, family: "lp-10m", flag: "nur-pdf", list: 12 },
  evening: "2026-09-25",
}

describe("Wege zwischen den Seiten", () => {
  it("aus dem Fortschritt öffnen: Herkunft ohne Wahl und Wertung, die Scheibe öffnet in ihrer Wertung", () => {
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
      scoring: null,
      anchor: null,
    })
    expect(urlFromRoute(card)).toBe(
      "/cards/c42?from=progress&range=neue-munition&compare=previous&family=lg-10m&kind=training&metric=sigma"
    )
  })

  it("Rundreise: öffnen und zurück ergibt denselben Fortschritt, gewählt ist die Scheibe; die Wertung hat die Familie", () => {
    const back = backRoute(openCard(PROGRESS, "c42"))
    expect(back).toEqual({
      ...PROGRESS,
      query: { ...PROGRESS.query, scoring: DEFAULT_PROGRESS.scoring, chosen: "c42" },
      section: null,
    })
    // auf der Scheibe die Wertung gewechselt: die gehört der Scheibe, nicht dem Fortschritt
    const switched = { ...openCard(PROGRESS, "c42"), scoring: "rings" as const }
    expect(backRoute(switched)).toEqual(back)
  })

  it("aus der Liste öffnen und zurück ergibt dieselbe Liste mit der Scheibe gewählt; der Abend fällt weg", () => {
    const card = openCard(LIST, "c7")
    expect(card.origin).toEqual({ from: "list", query: LIST.query })
    expect(card.scoring).toBeNull()
    expect(backRoute(card)).toEqual({ ...LIST, evening: null, pick: "c7" })
  })

  it("von Start und als direkter Link; eine Wertung nur, wenn der Weg eine gibt (ein Rekord)", () => {
    expect(backRoute(openCard({ page: "start" }, "c1"))).toEqual({ page: "start" })
    expect(openCard({ page: "start" }, "c1").scoring).toBeNull()
    expect(openCard({ page: "start" }, "c1", "rings").scoring).toBe("rings")
    const direct = openCard({ page: "scan" }, "c1", "rings")
    expect(direct.origin).toBeNull()
    expect(direct.scoring).toBe("rings")
    expect(backRoute(direct)).toEqual({ page: "cards", query: DEFAULT_LIST, evening: null })
  })

  it("Blättern behält Herkunft und Abschnitt und verliert Auswahl, Schuss, Reiter und Wertung", () => {
    const card = {
      ...openCard(PROGRESS, "c42"),
      selection: 2,
      shot: "23",
      scoring: "rings",
      anchor: { section: "analysis", tab: "position" },
    } as const
    // die nächste Scheibe öffnet in ihrer Wertung
    expect(siblingRoute(card, "c43")).toEqual({
      ...card,
      id: "c43",
      selection: null,
      shot: null,
      scoring: null,
      anchor: { section: "analysis" },
    })
    // die nächste Scheibe öffnet die Analyse mit dem ersten Reiter
    expect(urlFromRoute(siblingRoute(card, "c43"))).toMatch(/#analysis$/)
    expect(siblingRoute({ ...card, anchor: { section: "shots" } }, "c43").anchor).toEqual({
      section: "shots",
    })
    expect(siblingRoute({ ...card, anchor: null }, "c43").anchor).toBeNull()
  })

  it("Querverweise: Familie, Art und Zeitraum gehen mit; eine Liste ohne Zeitraum wird „Alles“", () => {
    expect(listFromProgress(PROGRESS)).toEqual({
      page: "cards",
      query: {
        family: "lg-10m",
        kind: "training",
        flag: null,
        list: null,
        range: { type: "named", id: "neue-munition" },
      },
      evening: null,
      // die Wahl des Fortschritts ist in der Liste markiert
      pick: "c3",
    })
    expect(
      listFromProgress({ ...PROGRESS, query: { ...PROGRESS.query, chosen: null } })
    ).not.toHaveProperty("pick")
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
    // die Liste hat keine Wertung; es gilt die des Geräts wie bei `openCard`
    expect(progressFromList(LIST, "rings").query.scoring).toBe("rings")
  })

  it("eine Kennzahl einer Familie: nur Familie und Kennzahl in der Adresse", () => {
    const route = progressWithMetric("lp-freihand", "group.sigma")
    expect(route).toEqual({
      page: "progress",
      query: { ...DEFAULT_PROGRESS, family: "lp-freihand", metric: "group.sigma" },
      section: null,
    })
    expect(urlFromRoute(route)).toBe("/progress?family=lp-freihand&metric=sigma")
  })
})

describe("Beschriftung des Rückwegs", () => {
  const context = {
    named: [{ id: "neue-munition", name: "Neue Munition", from: "2026-08-01", to: null }],
    timeZone: "Europe/Berlin",
  }
  const fromProgress = (choice: ProgressRoute["query"]["choice"]) =>
    openCard({ ...PROGRESS, query: { ...PROGRESS.query, choice } }, "c42")

  it("der Zeitraum mit seinem Namen wie in der Seite eines Zeitraums", () => {
    expect(backLabel(fromProgress({ type: "rolling", days: 90 }), context)).toBe("Letzte 90 Tage")
    expect(backLabel(fromProgress({ type: "all" }), context)).toBe("Alles")
    expect(backLabel(fromProgress({ type: "named", id: "neue-munition" }), context)).toBe(
      "Neue Munition"
    )
    expect(
      backLabel(fromProgress({ type: "free", from: "2026-05-01", to: "2026-06-30" }), context)
    ).toBe("01.05.2026 – 30.06.2026")
  })

  it("Start, Liste und ein direkter Link", () => {
    expect(backLabel(openCard({ page: "start" }, "c1"), context)).toBe("Start")
    expect(backLabel(openCard(LIST, "c1"), context)).toBe("Scheiben")
    expect(backLabel(openCard({ page: "scan" }, "c1"), context)).toBe("Scheiben")
  })
})

describe("Fortschritt ↔ Zustand der Seite", () => {
  it("Rundreise Zustand → Route → Zustand über alle Felder", () => {
    const states: PeriodState[] = [
      initialPeriodState({ family: "lg-10m" }),
      {
        choice: { type: "free", from: "2026-05-01", to: "2026-06-30" },
        compare: { type: "named", id: "saison-2025" },
        family: "lp-10m",
        kind: "competition",
        includeProbeOnly: false,
        scoring: "rings",
        metric: "time.intervalMedian",
        view: "cards",
        chosen: "c9",
      },
    ]
    for (const state of states) {
      const route = progressRoute(state, "history")
      expect(route.section).toBe("history")
      expect(periodStateFromRoute(route, "lg-10m")).toEqual(state)
      // auch über die Adresse: Zustand → Adresse → Route → Zustand
      const back = routeFromHref(urlFromRoute(route))
      expect(back.page).toBe("progress")
      expect(periodStateFromRoute(back as ProgressRoute, "lg-10m")).toEqual(state)
    }
  })

  it("ohne Familie in der Adresse gilt die zuletzt benutzte", () => {
    const route: ProgressRoute = { page: "progress", query: DEFAULT_PROGRESS, section: null }
    expect(periodStateFromRoute(route, "lp-10m")).toEqual(initialPeriodState({ family: "lp-10m" }))
  })

  it("„restore“ setzt den ganzen Zustand, auch die Wahl", () => {
    const before = initialPeriodState({ family: "lg-10m", chosen: "c1" })
    const after = periodStateFromRoute(
      backRoute(openCard(PROGRESS, "c42")) as ProgressRoute,
      "lg-10m"
    )
    expect(periodReducer(before, { type: "restore", state: after })).toEqual(after)
    expect(periodReducer(before, { type: "restore", state: after }).chosen).toBe("c42")
  })
})
