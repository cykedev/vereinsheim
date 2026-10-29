import { describe, expect, it } from "vitest"

import {
  disciplineOptions,
  statisticsPage,
  statisticsState,
  statisticsUrl,
  STATISTICS_TILES,
} from "@/lib/statistics/page"
import type { StatisticsSession } from "@/lib/statistics/sessions"

const NOW = Date.UTC(2026, 9, 1, 10)
const DAY = 86_400_000
const LG = {
  id: "lg",
  name: "Luftgewehr",
  seriesCount: 4,
  shotsPerSeries: 10,
  scoringType: "TENTH",
}
const KK = {
  id: "kk",
  name: "Kleinkaliber",
  seriesCount: 4,
  shotsPerSeries: 10,
  scoringType: "WHOLE",
}

function session(
  id: string,
  daysAgo: number,
  discipline: StatisticsSession["discipline"],
  totals: number[]
): StatisticsSession {
  return {
    id,
    date: new Date(NOW - daysAgo * DAY),
    type: "TRAINING",
    discipline,
    hitLocationHorizontalMm: null,
    hitLocationHorizontalDirection: null,
    hitLocationVerticalMm: null,
    hitLocationVerticalDirection: null,
    series: totals.map((total, i) => ({
      position: i + 1,
      isPractice: false,
      scoreTotal: total,
      shots: null,
      executionQuality: null,
    })),
    wellbeing: null,
    prognosis: null,
    feedback: null,
  }
}

// in zeitlicher Folge: Kleinkaliber zuletzt geschossen, eine Einheit ohne Disziplin und eine ohne Ergebnis
const SESSIONS = [
  session("lg1", 20, LG, [95, 96]),
  session("lg2", 10, LG, [97, 98]),
  session("leer", 5, LG, []),
  session("frei", 4, null, [90]),
  session("kk1", 3, KK, [92, 93]),
]

const page = (search: string, hidden: string[] = []) =>
  statisticsPage({
    sessions: SESSIONS,
    search: new URLSearchParams(search),
    hidden,
    nowMs: NOW,
    timeZone: "Europe/Berlin",
  })

describe("Disziplinen der Statistik", () => {
  it("nur mit Einheiten mit Ergebnis, die zuletzt geschossene zuerst, Wertung aus der Disziplin", () => {
    expect(disciplineOptions(SESSIONS, [])).toEqual([
      { value: "kk", label: "Kleinkaliber", switchable: false },
      { value: "lg", label: "Luftgewehr", switchable: true },
    ])
  })

  it("ausgeblendete fehlen, außer es gibt nur ausgeblendete", () => {
    expect(disciplineOptions(SESSIONS, ["kk"]).map((o) => o.value)).toEqual(["lg"])
    expect(disciplineOptions(SESSIONS, ["kk", "lg"]).map((o) => o.value)).toEqual(["kk", "lg"])
  })
})

describe("Zustand der Statistik aus der Adresse", () => {
  const options = disciplineOptions(SESSIONS, [])

  it("ohne Angabe die zuletzt geschossene Disziplin, Probe zählt nie", () => {
    const { state } = statisticsState(new URLSearchParams("sighters=0"), options)!
    expect(state.family).toBe("kk")
    expect(state.includeWarmup).toBe(false)
  })

  it("ganze Ringe nur in Zehntel-Disziplinen wählbar, gemerkt je Disziplin, sonst immer", () => {
    const scoring = (q: string, scorings: Record<string, "rings" | "decimal"> = {}) =>
      statisticsState(new URLSearchParams(q), options, { choice: null, scorings })!.state.scoring
    expect(scoring("family=lg")).toBe("decimal")
    // die gemerkte Wertung der Disziplin gilt, eine Wertung in der Adresse nicht (wie in Spiegel)
    expect(scoring("family=lg", { lg: "rings" })).toBe("rings")
    expect(scoring("family=lg&scoring=rings")).toBe("decimal")
    // je Disziplin: die gemerkte von Luftgewehr gilt nicht für eine andere
    expect(scoring("family=kk", { lg: "decimal" })).toBe("rings")
  })

  it("Kennzahlen ohne Wert in Treffsicher (Streuung, Tempo) fallen auf den Ø je Schuss zurück", () => {
    const metric = (q: string) => statisticsState(new URLSearchParams(q), options)!.state.metric
    expect(metric("metric=sigma")).toBe("result.decimalMean")
    expect(metric("metric=tempo")).toBe("result.decimalMean")
    expect(metric("metric=location")).toBe("group.mpiDistance")
    expect(metric("metric=tens")).toBe("result.tensRate")
  })

  it("die Adresse hin und zurück, ohne Wertung", () => {
    const memory = { choice: null, scorings: { lg: "rings" as const } }
    const { state } = statisticsState(
      new URLSearchParams("family=lg&range=6m&metric=location"),
      options,
      memory
    )!
    const url = statisticsUrl(state)
    expect(url).toBe("/statistics?range=6m&family=lg&metric=location")
    const back = statisticsState(new URLSearchParams(url.split("?")[1]), options, memory)!.state
    expect(back).toEqual(state)
  })

  it("ohne eigene Abfrage gilt der gemerkte Zeitraum, mit eigener die Adresse", () => {
    const memory = { choice: { type: "rolling" as const, days: 182 as const }, scorings: {} }
    const choice = (q: string) =>
      statisticsState(new URLSearchParams(q), options, memory)!.state.choice
    expect(choice("")).toEqual({ type: "rolling", days: 182 })
    // die Disziplin zählt nicht als eigene Abfrage
    expect(choice("family=lg")).toEqual({ type: "rolling", days: 182 })
    expect(choice("range=all")).toEqual({ type: "all" })
    expect(choice("family=lg&kind=training").type).toBe("rolling")
    expect(choice("family=lg&kind=training")).toEqual({ type: "rolling", days: 90 })
  })
})

describe("Seite der Statistik", () => {
  it("rechnet die gewählte Disziplin mit den Kacheln von Treffsicher", () => {
    const result = page("family=lg&range=all")!
    expect(result.option.value).toBe("lg")
    expect(result.model.cards.map((c) => c.id)).toEqual(["lg1", "lg2"])
    expect(result.model.tiles.map((t) => t.key)).toEqual([...STATISTICS_TILES])
    // Ø je Schuss aus den Serien: (191 / 20 + 195 / 20) / 2
    expect(result.model.summary.mean).toBeCloseTo(9.65, 10)
    // leichtes Modell: ohne Werte je Einheit
    expect(result.model.cards[0].metrics).toEqual({})
  })

  it("Einflüsse und Selbstbild nur über die Einheiten der Seite", () => {
    const wellbeing = { sleep: 70, energy: 60, stress: 20, motivation: 80 }
    const self = {
      fitness: 50,
      nutrition: 50,
      technique: 50,
      tactics: 50,
      mentalStrength: 50,
      environment: 50,
      equipment: 50,
    }
    const sessions = [
      // vor dem Zeitraum der letzten 30 Tage: zählt nicht
      {
        ...session("alt", 60, LG, [95]),
        wellbeing,
        prognosis: self,
        feedback: self,
        hitLocationHorizontalMm: 1,
        hitLocationHorizontalDirection: "LEFT" as const,
        hitLocationVerticalMm: 1,
        hitLocationVerticalDirection: "LOW" as const,
      },
      { ...session("neu", 5, LG, [96]), wellbeing, prognosis: self, feedback: self },
      { ...session("wk", 4, LG, [97]), type: "WETTKAMPF", wellbeing },
    ]
    const result = statisticsPage({
      sessions,
      search: new URLSearchParams("family=lg&range=30d&kind=training"),
      hidden: [],
      nowMs: NOW,
      timeZone: "Europe/Berlin",
    })!
    expect(result.model.cards.map((c) => c.id)).toEqual(["neu"])
    expect(result.influences.find((i) => i.key === "sleep")?.entered).toBe(1)
    expect(result.influences.find((i) => i.key === "quality")?.entered).toBe(0)
    expect(result.selfImage.n).toBe(1)
    // Tabelle, Trefferlage und Ringverteilung ebenso nur über die Einheit der Seite
    expect(result.overview?.sessionCount).toBe(1)
    expect(result.location.points).toEqual([])
    expect(result.rings.sessions).toBe(0)
  })

  it("ohne Einheit mit Ergebnis keine Seite", () => {
    expect(
      statisticsPage({
        sessions: [session("leer", 1, LG, [])],
        search: new URLSearchParams(),
        hidden: [],
        nowMs: NOW,
        timeZone: "Europe/Berlin",
      })
    ).toBeNull()
  })
})
