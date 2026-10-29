import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"

import type { InfluenceRow } from "../analysis/influences"
import type { AnalysisView, FactorView } from "../analysis/queries"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))

const { AnalysisScreen } = await import("./AnalysisScreen")
const { InfluenceStrip } = await import("./InfluenceStrip")
const { FactorScreen } = await import("./FactorScreen")

const ZONE = "Europe/Berlin"
const LP = { id: 1, slug: "lp", name: "Luftpistole" }
const LG = { id: 2, slug: "lg", name: "Luftgewehr" }
const SEASON = { from: "2026-09-01", to: "2027-08-31", label: "Saison 26/27" }

const comparison = (verdict: PeriodComparison["verdict"], delta = 0.4): PeriodComparison => ({
  a: { n: 6, mean: -0.2 },
  b: { n: 6, mean: 0.2 },
  delta,
  test: { p: 0.01, exact: false },
  basis: "shots",
  verdict,
  meaningful: false,
})

const row = (aspect: InfluenceRow["aspect"], over: Partial<InfluenceRow> = {}): InfluenceRow => ({
  aspect,
  entered: 12,
  high: { n: 6, mean: 0.2 },
  low: { n: 6, mean: -0.2 },
  comparison: comparison("higher"),
  points: [],
  ...over,
})

const EMPTY: AnalysisView = {
  families: [],
  family: null,
  seasons: [],
  season: null,
  influences: { withWellbeing: 0, rows: [], left: { noCard: 0, noForm: 0 } },
  execution: { series: 0, evenings: 0, sameRated: 0, high: 0, low: 0, comparison: null, rated: 0 },
  expected: { rows: [], mean: null, left: 0 },
  beforeAfter: {
    n: 0,
    rows: [
      "fitness",
      "nutrition",
      "technique",
      "tactics",
      "mentalStrength",
      "environment",
      "equipment",
    ].map((aspect) => ({ aspect, prognosis: null, feedback: null, pairs: 0 })),
  } as AnalysisView["beforeAfter"],
}

const FULL: AnalysisView = {
  ...EMPTY,
  families: [LP, LG],
  family: LP,
  seasons: [SEASON],
  season: SEASON,
  influences: {
    withWellbeing: 14,
    rows: [
      row("sleep"),
      row("energy", {
        comparison: comparison("lower", -0.4),
        high: { n: 6, mean: -0.2 },
        low: { n: 6, mean: 0.2 },
      }),
      row("stress", { comparison: comparison("unclear") }),
      row("motivation", {
        high: { n: 0, mean: null },
        low: { n: 0, mean: null },
        comparison: null,
      }),
    ],
    left: { noCard: 2, noForm: 0 },
  },
  execution: {
    series: 12,
    evenings: 2,
    sameRated: 1,
    high: 6,
    low: 6,
    comparison: comparison("higher"),
    rated: 14,
  },
  expected: {
    rows: Array.from({ length: 7 }, (_, i) => ({
      entryId: `e${i}`,
      day: `2026-10-${String(20 - i).padStart(2, "0")}`,
      expected: 360,
      shot: { value: i % 2 ? 365 : 355, scoring: "rings" as const, digits: 0 },
      delta: i % 2 ? 5 : -5,
    })),
    mean: -0.7,
    left: 1,
  },
  beforeAfter: {
    n: 3,
    rows: EMPTY.beforeAfter.rows.map((r) =>
      r.aspect === "technique" ? { ...r, prognosis: 70, feedback: 50, pairs: 3 } : r
    ),
  },
}

const render = (view: AnalysisView) =>
  renderToStaticMarkup(createElement(AnalysisScreen, { view, timeZone: ZONE }))
const order = (html: string, marks: string[]) => marks.map((m) => html.indexOf(m))

describe("Auswertung", () => {
  it("zeigt für ein neues Konto alle Abschnitte mit ihren Leersätzen, ohne Filter", () => {
    const html = render(EMPTY)
    const positions = order(html, [
      "data-diary-switch",
      "data-influences",
      "data-self-image",
      "data-execution",
      "data-expected",
      "data-before-after",
    ])
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).not.toContain("data-analysis-filters")
    expect(html).toContain("Noch kein Eintrag mit Befinden.")
    expect(html).toContain("Noch keine bewertete Serie.")
    expect(html).toContain("Noch kein Eintrag mit erwartetem Ergebnis.")
    expect(html).toContain("Noch kein Eintrag mit Prognose und Feedback.")
    expect(html).toContain('data-help="diary-influences"')
    expect(html).toContain('data-help="diary-selfImage"')
  })

  it("mit Daten dieselbe Folge, dazu Filter, je Merkmal eine Zeile mit Pille", () => {
    const html = render(FULL)
    const positions = order(html, [
      "data-analysis-filters",
      "data-influences",
      "data-execution",
      "data-expected",
      "data-before-after",
    ])
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).toContain("14 Einträge mit Befinden.")
    expect([...html.matchAll(/data-pill="([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "better",
      "worse",
      "none",
      "none",
      "better",
    ])
    expect(html).toContain("Guter Schlaf: besser")
    expect(html).toContain("Viel Energie: schwächer")
    expect(html).toContain("Kein klarer Unterschied")
    expect(html).toContain("Noch kein Urteil")
  })

  it("die Saisons stehen in einer Zeile, die wischt, „Alles“ zuerst", () => {
    const html = render({
      ...FULL,
      seasons: [SEASON, { ...SEASON, from: "2025-09-01", label: "Saison 25/26" }],
    })
    const group = html.match(/<div[^>]*role="radiogroup"[^>]*>/)?.[0] ?? ""
    expect(group).toContain('aria-label="Zeitraum"')
    expect(group).toContain("overflow-x-auto")
    expect(group).not.toContain("flex-wrap")
    const labels = [...html.matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1])
    expect(labels).toEqual(["Alles", "Saison 26/27", "Saison 25/26"])
  })

  it("die Pille steht neben dem Namen und bricht nie in sich um", () => {
    const html = render(FULL)
    const head = html.match(/data-influence-head[^>]*>([\s\S]*?)<\/span><\/span>/)?.[1] ?? ""
    expect(head).toContain("Schlaf")
    expect(head).toContain("Guter Schlaf: besser")
    const pills = [...html.matchAll(/<span[^>]*data-pill="[a-z]+"[^>]*>/g)].map((m) => m[0])
    expect(pills.length).toBeGreaterThan(4)
    for (const pill of pills) expect(pill).toContain("whitespace-nowrap")
  })

  it("jede Zeile ist ein Link mit Disziplin und Zeitraum", () => {
    const html = render(FULL)
    expect(html).toMatch(
      /<a(?=[^>]*data-influence="sleep")(?=[^>]*href="\/diary\/analysis\/sleep\?family=lp&amp;season=2026")/
    )
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/analysis\?family=lg&amp;season=2026")/)
  })

  it("nennt die Grundlage nur, wenn etwas nicht zählt", () => {
    expect(render(FULL)).toContain("2 Einträge ohne Scheibe zählen nicht mit.")
    const all = render({
      ...FULL,
      influences: { ...FULL.influences, left: { noCard: 0, noForm: 0 } },
    })
    expect(all).not.toContain("data-influence-basis")
  })

  it("Selbstbild: Ausführung mit Grundlage, Tabelle mit Vorzeichen und fünf Zeilen, „–“ mit Grund", () => {
    const html = render(FULL)
    expect(html).toContain("Ja")
    expect(html).toContain("12 Serien an 2 Abenden")
    expect(html).toContain("1 Scheibe mit gleich bewerteten Serien zählt nicht mit.")
    expect(html.match(/data-expected-row=/g)).toHaveLength(5)
    expect(html).toContain("Alle 7 Einträge zeigen")
    expect(html).toMatch(/data-delta="down"[^>]*text-warning[^>]*>−5</)
    expect(html).toMatch(/data-delta="up"[^>]*text-success[^>]*>\+5</)
    expect(html).toContain(
      "1 Eintrag mit erwartetem Ergebnis hat nicht genau eine Scheibe mit Ergebnis und fehlt hier."
    )
    expect(html.match(/data-no-pair/g)).toHaveLength(6)
    expect(html).toContain("kein Eintrag mit beidem")
    expect(html).toMatch(
      /data-before-after-row="technique"[\s\S]*data-before="4"[\s\S]*data-after="3"/
    )
  })
})

describe("InfluenceStrip", () => {
  it("zeigt beide Punkte und die Verbindung, ohne Gruppe keinen Punkt", () => {
    const both = renderToStaticMarkup(createElement(InfluenceStrip, { high: 0.2, low: -0.1 }))
    expect(both).toContain("data-strip-high")
    expect(both).toContain("data-strip-low")
    expect(both).toContain(">+0,3<")
    const none = renderToStaticMarkup(createElement(InfluenceStrip, { high: null, low: null }))
    expect(none).not.toContain("data-strip-high")
    expect(none).not.toContain("data-strip-low")
    const wide = renderToStaticMarkup(createElement(InfluenceStrip, { high: 0.52, low: -0.1 }))
    expect(wide).toContain(">+0,6<")
  })
})

describe("Seite eines Merkmals", () => {
  const points = Array.from({ length: 8 }, (_, i) => ({
    entryId: `e${i}`,
    day: `2026-10-${String(10 + i).padStart(2, "0")}`,
    competition: i === 7,
    value: i < 4 ? 30 : 70,
    distance: i < 4 ? -0.2 : 0.3,
    side: (i < 3 ? "low" : i < 4 ? "none" : "high") as "low" | "none" | "high",
  }))
  const view: FactorView = {
    family: LP,
    season: SEASON,
    aspect: "energy",
    row: row("energy", { entered: 8, points }),
    left: { noCard: 0, noForm: 1 },
  }
  const html = renderToStaticMarkup(createElement(FactorScreen, { view, timeZone: ZONE }))

  it("Rückweg mit Disziplin und Zeitraum, Name, Unterzeile, Urteil mit Abstand", () => {
    expect(html).toMatch(
      /<a[^>]*href="\/diary\/analysis\?family=lp&amp;season=2026"[^>]*>[\s\S]*Auswertung/
    )
    expect(html).toContain(">Energie</h1>")
    expect(html).toContain("Luftpistole · Saison 26/27 · 8 Einträge")
    expect(html).toContain("Viel Energie: besser")
    expect(html).toContain("Abstand +0,40")
    expect(html).toContain("1 Eintrag ohne fünf Scheiben davor zählt nicht mit.")
  })

  it("jeder Punkt ist ein Link in den Eintrag, die Seite in Farbe und Form", () => {
    const links = [
      ...html.matchAll(
        /<a[^>]*href="(\/diary\/e\d)"[^>]*data-point="([a-z]+)"[^>]*aria-label="([^"]*)"/g
      ),
    ]
    expect(links).toHaveLength(8)
    expect(links.map((m) => m[2]).sort()).toEqual([
      "high",
      "high",
      "high",
      "high",
      "low",
      "low",
      "low",
      "none",
    ])
    expect(links[7][3]).toBe("Sa 17.10., Energie 4, +0,30 zur Form")
    expect(html).toMatch(/data-point="high"[\s\S]*?class="fill-primary"/)
    expect(html).toMatch(/data-point="none"[\s\S]*?class="fill-quiet"/)
  })

  it("die Einträge neueste oben, die ersten fünf, dann „Alle 8 Einträge zeigen“", () => {
    const entries = [...html.matchAll(/data-factor-entry="(e\d)"/g)].map((m) => m[1])
    expect(entries).toEqual(["e7", "e6", "e5", "e4", "e3"])
    expect(html).toContain("Alle 8 Einträge zeigen")
    expect(html).toContain("Wettkampf · Energie 4")
    const few = renderToStaticMarkup(
      createElement(FactorScreen, {
        view: { ...view, row: row("energy", { entered: 5, points: points.slice(0, 5) }) },
        timeZone: ZONE,
      })
    )
    expect(few).not.toContain("Einträge zeigen")
  })
})
