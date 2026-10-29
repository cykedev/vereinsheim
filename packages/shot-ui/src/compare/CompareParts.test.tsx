import { describe, expect, it } from "vitest"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"

import { DEFAULT_COMPARE } from "../nav/routes"
import { CardChoiceSheet, PeriodChoiceSheet, type CardChoice } from "./ChoiceSheets"
import { CompareControls } from "./CompareControls"
import { CompareTable } from "./CompareTable"
import type { CompareModel, CompareRow } from "./model"

const TZ = "Europe/Berlin"
const noop = () => {}
const FAMILIES = [
  { value: "lp-freihand", label: "LP Freihand" },
  { value: "lg-freihand", label: "LG Freihand" },
]

const comparison: PeriodComparison = {
  a: { n: 10, mean: 9.2 },
  b: { n: 8, mean: 9 },
  delta: 0.2,
  basis: "cards",
  test: { p: 0.01, exact: true },
  verdict: "higher",
  meaningful: true,
}
const row = (key: string, a: number | null, unit: CompareRow["unit"] = "Ringe"): CompareRow => ({
  key,
  label: key === "group.sigma" ? "Streuung" : "Ø je Schuss",
  unit,
  decimals: 2,
  better: key === "group.sigma" ? "lower" : "higher",
  a,
  b: 9,
  comparison,
})
const MODEL: CompareModel = {
  type: "periods",
  unit: "card",
  a: {
    name: "Letzte 90 Tage",
    at: "in den letzten 90 Tagen",
    short: "90 Tage",
    cards: 10,
    shots: 400,
    withoutPosition: 0,
    withoutValues: 0,
    reason: null,
  },
  b: {
    name: "Zeitraum davor",
    at: "im Zeitraum davor",
    short: "davor",
    cards: 8,
    shots: 320,
    withoutPosition: 0,
    withoutValues: 0,
    reason: null,
  },
  shared: 0,
  result: row("result.decimalMean", 9.2),
  spread: row("group.sigma", null, "mm"),
  position: null,
  metrics: [row("result.decimalMean", 9.2), row("group.sigma", 1.5, "mm")],
  picture: {
    style: "dots",
    halfUm: 1000,
    focus: null,
    a: { kind: "dots" as const, points: [], center: null },
    b: { kind: "dots" as const, points: [], center: null },
  },
}

describe("CompareControls", () => {
  const render = (query = DEFAULT_COMPARE) =>
    renderToStaticMarkup(
      h(CompareControls, {
        query,
        family: "lp-freihand",
        families: FAMILIES,
        names: { a: "Letzte 90 Tage", b: "Zeitraum davor" },
        newest: ["c2", "c1"],
        onQuery: noop,
        onPick: noop,
      })
    )

  it("zwei Zeiträume: Art des Vergleichs, Familie, zwei Chips mit Namen und die Art", () => {
    const html = render()
    for (const label of [
      "Zwei Scheiben",
      "Zwei Zeiträume",
      "Wettkampf und Training",
      "LP Freihand",
    ])
      expect(html, label).toContain(label)
    expect(html).toMatch(/data-compare-chip="a"[^>]*>.*Letzte 90 Tage/)
    expect(html).toMatch(/data-compare-chip="b"[^>]*>.*Zeitraum davor/)
    expect(html).toContain("Alle Arten")
    expect(html).toContain("var(--compare-a)")
  })

  it("die Art des Vergleichs ist eine Zeile, die wischt, wie Reiter", () => {
    // das Markup maskiert „&“ und „>“ im Attribut
    const bar = (render().match(/aria-label="Was vergleichen"[^>]*class="([^"]+)"/)?.[1] ?? "")
      .replaceAll("&amp;", "&")
      .replaceAll("&gt;", ">")
      .split(" ")
    for (const cls of ["overflow-x-auto", "min-w-0", "max-w-full", "[&>button]:whitespace-nowrap"])
      expect(bar).toContain(cls)
    expect(bar).not.toContain("flex-wrap")
  })

  it("zwei Scheiben: mit Familie, ohne Art", () => {
    const html = render({ type: "cards", family: null, a: "c2", b: "c1" })
    expect(html).toContain("LP Freihand")
    expect(html).toContain("LG Freihand")
    expect(html).not.toContain("Alle Arten")
    expect(html).toContain('data-compare-chip="b"')
  })

  it("am Ende der Zeile die Aktionen, in der App die Wertung", () => {
    const html = renderToStaticMarkup(
      h(CompareControls, {
        query: DEFAULT_COMPARE,
        family: "lp-freihand",
        families: FAMILIES,
        names: { a: "Letzte 90 Tage", b: "Zeitraum davor" },
        newest: [],
        onQuery: noop,
        onPick: noop,
        actions: h("span", null, "In Zehnteln"),
      })
    )
    expect(html).toMatch(/data-compare-actions[^>]*><span>In Zehnteln/)
  })

  it("Wettkampf und Training: ein Chip für den Zeitraum", () => {
    const html = render({
      type: "kind",
      family: null,
      range: { type: "rolling", days: 365 },
      includeWarmup: false,
    })
    expect(html).toContain('data-compare-chip="range"')
    expect(html).not.toContain('data-compare-chip="b"')
  })
})

describe("CompareTable", () => {
  it("alle Zahlen in einer Tabelle, Spalten mit den kurzen Namen, Gold für den klar besseren Wert", () => {
    const html = renderToStaticMarkup(h(CompareTable, { model: MODEL, onHelp: noop }))
    expect(html).toContain('data-compare-row="result.decimalMean"')
    expect(html).toContain('data-compare-row="group.sigma"')
    expect(html).toContain('data-compare-row="position"')
    expect(html).toContain(">90 Tage<")
    expect(html).toContain(">davor<")
    // Ø je Schuss: A klar höher, also A in Gold
    expect(html).toMatch(/data-compare-row="result.decimalMean".*?data-gold="true"[^>]*>9,20/)
    expect(html).toContain("(klar besser)")
    expect(html).toContain('title="Ohne Lage der Schüsse."')
    expect(html).toContain('data-help="zeitraum-vergleich"')
    expect(html).toContain('data-help="lage-vergleich"')
    expect(html).toContain("Gold heißt: ein klarer Unterschied")
    expect(html).not.toContain("Alle Kennzahlen")
  })

  it("gleich gebaute Zahlen: Einheit beim Namen, zwei gleich breite Spalten, die Lage als eigene Zeile", () => {
    const html = renderToStaticMarkup(h(CompareTable, { model: MODEL, onHelp: noop }))
    // zwei gleich breite Spalten für die Zahlen
    expect(html).toMatch(/grid-cols-\[minmax\(0,1fr\)_(\d+rem)_\1\]/)
    expect(html).toMatch(/Ø je Schuss<span[^>]*>Ringe<\/span>/)
    expect(html).toMatch(/data-compare-row="position" class="[^"]*flex[^"]*justify-between/)
  })

  it("zwei Scheiben: die Hilfe des Schussvergleichs", () => {
    const html = renderToStaticMarkup(
      h(CompareTable, { model: { ...MODEL, unit: "shot" }, onHelp: noop })
    )
    expect(html).toContain('data-help="scheibe-vergleich"')
  })
})

describe("Blätter", () => {
  const choices: CardChoice[] = Array.from({ length: 35 }, (_, i) => ({
    id: `c${i}`,
    startedAtMs: Date.UTC(2026, 9, 20 - (i % 20), 17),
    total: `36${i % 10},4`,
    shots: 40,
  }))

  it("Scheiben: 30 auf einmal, „Mehr zeigen“, die andere Seite geht nicht", () => {
    const html = renderToStaticMarkup(
      h(CardChoiceSheet, {
        open: true,
        onClose: noop,
        title: "Scheibe A",
        choices,
        current: "c0",
        other: "c1",
        timeZone: TZ,
        onChoose: noop,
      })
    )
    expect([...html.matchAll(/type="radio"/g)]).toHaveLength(30)
    expect(html).toContain("Mehr zeigen")
    expect(html).toContain("auf der anderen Seite")
    expect(html).toContain("360,4 · 40 Schuss")
    expect(html).toMatch(/<input type="radio" disabled=""/)
  })

  it("Zeitraum B: „Zeitraum davor“ zuerst, die Felder wie im Filter, „Übernehmen“", () => {
    const html = renderToStaticMarkup(
      h(PeriodChoiceSheet, {
        open: true,
        onClose: noop,
        title: "Zeitraum B",
        value: "previous",
        range: {
          fromMs: Date.UTC(2026, 6, 1),
          toMs: Date.UTC(2026, 9, 1),
          label: "Letzte 90 Tage",
        },
        named: [],
        timeZone: TZ,
        withPrevious: true,
        onApply: noop,
      })
    )
    expect(html.indexOf("Zeitraum davor")).toBeLessThan(html.indexOf("Letzte 30 Tage"))
    expect(html).toContain("gleich lang, direkt vor A")
    expect(html).toContain("Übernehmen")
    expect(html).toMatch(/<input type="radio"[^>]*checked=""/)
  })
})
