import { shotNumbers, type MetricShot } from "@vereinsheim/shot-core/metrics"
import { FALLACIES } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { asOnPrintout } from "../shots"
import { initialViewState } from "../view-state"
import { AnalysisPanel, ANALYSIS_TABS } from "./AnalysisPanel"
import { analysisInput } from "./input"
import { renderTab } from "./testPanel"
import { fortyCard } from "./testCard"

const shot = (
  seq: number,
  kind: "probe" | "match",
  xUm: number,
  firedAtMs: number | null,
  flags?: string[]
): MetricShot => ({
  seq,
  xUm,
  yUm: 0,
  decimalTenths: 104,
  ring: 10,
  innerTen: false,
  firedAtMs,
  kind,
  series: kind === "match" ? 1 : null,
  ...(flags ? { flags } : {}),
})

// zwei Probeschüsse, drei Wertungsschüsse, einer davon ohne Zeit
const CARD = [
  shot(1, "probe", 3000, 0),
  shot(2, "probe", 1000, 40_000),
  shot(3, "match", 0, 90_000),
  shot(4, "match", 500, null),
  shot(5, "match", -500, 180_000),
]

const render = (shots: readonly MetricShot[], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisPanel, {
      shots,
      state: initialViewState(),
      target: LP_10M,
      tab: "overview",
      onTab: () => {},
      explain: false,
      onToggleLayer: () => {},
      onHelp: () => {},
      ...extra,
    })
  )

describe("analysisInput: worüber die Analyse rechnet", () => {
  it("mit Wertung über die Scheibe wie am Ausdruck, ohne die Probe (U4)", () => {
    const input = analysisInput(CARD, "decimal", LP_10M)
    expect(input.base).toEqual(CARD.slice(2))
    expect(input.all).toEqual(CARD.slice(2))
    expect(input.basis).toBe("alle")
  })

  it("nur Probe: über alle Probeschüsse, auch ohne asOnPrintout der Seite", () => {
    const probes = CARD.slice(0, 2)
    const input = analysisInput(probes, "decimal", LP_10M)
    expect(input.base).toHaveLength(2)
    expect(input.base.every((s) => s.kind === "match")).toBe(true)
    expect(input.basis).toBe("nur Probe")
    // schon umgedeutet: dasselbe
    expect(analysisInput(asOnPrintout(probes), "decimal", LP_10M).basis).toBe("nur Probe")
  })

  it("nur Wertung: über alle Schüsse", () => {
    expect(analysisInput(CARD.slice(2), "decimal", LP_10M).basis).toBe("alle")
  })
})

describe("AnalysisPanel", () => {
  it("fünf Reiter in der Reihenfolge der Spielwiese, kein Reiter „Probe“ (U4)", () => {
    const html = render(CARD)
    const labels = [...html.matchAll(/<button[^>]*role="radio"[^>]*>([^<]+)<\/button>/g)].map(
      (m) => m[1]
    )
    expect(labels).toEqual(ANALYSIS_TABS.map((t) => t.label))
    expect(labels).toEqual(["Überblick", "Ergebnis", "Präzision", "Lage", "Zeit und Verlauf"])
    expect(html).toContain('aria-label="Thema"')
  })

  it("im Kopf rechts neben dem Titel die Aktion (der Schalter „Erklärungen“, U1), vor der Reiterleiste", () => {
    const html = render(CARD, { action: createElement("button", { "data-action": true }, "ERKL") })
    const title = html.indexOf("Was diese Scheibe zeigt")
    const action = html.indexOf("data-action")
    const tabs = html.indexOf('aria-label="Thema"')
    expect(title).toBeGreaterThan(-1)
    expect(action).toBeGreaterThan(title)
    expect(tabs).toBeGreaterThan(action)
    expect(html).toMatch(/<div data-analysis-head="true" class="[^"]*justify-between/)
    // ohne Aktion kein leerer Behälter
    expect(render(CARD)).not.toContain("data-analysis-action")
  })

  it("der Kopf nennt die Grundlage", () => {
    expect(render(CARD)).toContain("Analyse über alle Schüsse<")
    expect(render(CARD.slice(0, 2))).toContain("über alle Probeschüsse")
    expect(render(asOnPrintout(CARD.slice(0, 2)))).toContain("über alle Probeschüsse")
    expect(render(CARD.slice(2))).toContain("Analyse über alle Schüsse<")
  })

  it("Datenlage unter jedem Reiter, mit Merkmalen in Worten und der Wertung", () => {
    const flagged = [...CARD, shot(6, "match", 0, 200_000, ["verdaechtig"])]
    const text = render(flagged)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
    // ganze Wörter und Einzahl (Prüfung, Probe 10)
    expect(text).toContain(
      "Datenlage: 4 Wertungsschüsse · 1 ohne Zeit · 1 verdächtiger Schuss · Wertung in Zehnteln"
    )
    const misses = [
      ...CARD,
      shot(6, "match", 0, 200_000, ["fehlschuss"]),
      shot(7, "match", 0, 250_000, ["fehlschuss"]),
    ]
    expect(render(misses)).toContain("2 Fehlschüsse")
    const over = [...CARD, shot(6, "match", 0, 200_000, ["ueber-soll"])]
    expect(render(over)).toContain("1 Schuss über der Soll-Zahl")
    // in Zehnteln fehlt dem Schuss etwas, auch wenn er einen Ring hat (Prüfung, Probe 7)
    const tenthless = CARD.map((s, i) => (i === 3 ? { ...s, decimalTenths: null } : s))
    expect(render(tenthless)).toContain("1 ohne Zehntel")
    expect(render(tenthless, { state: initialViewState({ scoring: "rings" }) })).not.toContain(
      "ohne Zehntel"
    )
    // ein Training zählt die Probe wie Wertung, die Datenlage sagt das (Prüfung, Probe 8)
    const training = render(asOnPrintout(CARD.slice(0, 2)))
    expect(training).toContain("Datenlage: 2 Probeschüsse, als Training wie Wertung gezählt")
    expect(training).not.toContain("0 Wertungsschüsse")
    expect(render(CARD.slice(0, 1).map((s) => ({ ...s, firedAtMs: 0 })))).toContain(
      "alle mit Lage, Zeit und Wert"
    )
    expect(render(CARD, { state: initialViewState({ scoring: "rings" }) })).toContain(
      "Wertung in ganzen Ringen"
    )
    // „?“ an der Datenlage statt „Was heißt das?“ (Plan Schritt 4, D3)
    expect(render(CARD)).toMatch(
      /<div data-coverage="true"[^>]*>.*?<button[^>]*data-help="datenlage"/
    )
    expect(render(CARD)).not.toContain("<details data-help")
  })

  it("auf einer Trainingskarte zählt die Datenlage die Probe als Probe", () => {
    const text = render(asOnPrintout(CARD.slice(0, 2)))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
    expect(text).toContain("Datenlage: 2 Probeschüsse, als Training wie Wertung gezählt")
  })

  it("Glossar und typische Fehlschlüsse aus dem Paket, aufklappbar, auch mit „Erklärungen“ zu", () => {
    const html = render(CARD)
    expect([...html.matchAll(/<dt[^>]*data-term="true"[^>]*>/g)]).toHaveLength(GLOSSARY.length)
    for (const entry of GLOSSARY) expect(html).toContain(entry.term)
    expect([...html.matchAll(/<li[^>]*data-fallacy="true"/g)]).toHaveLength(FALLACIES.length)
    expect(html).toMatch(/<details data-glossary="true"(?! open)/)
    // „Erklärungen“ zeigt nur Kurzsätze; die Nachschlage-Listen bleiben zu (Plan Schritt 4, D3)
    expect(render(CARD, { explain: true })).not.toMatch(
      /<details data-(glossary|fallacies)="true" open/
    )
  })

  it("ohne Schüsse eine Karte, die sagt, was fehlt", () => {
    expect(render([])).toContain("Noch keine Schüsse auf dieser Scheibe.")
    // keine Datenlage, die „alle mit Lage, Zeit und Wert“ behauptet
    expect(render([])).not.toContain("data-coverage")
  })
})

describe("Lineal und Scheibe (Plan L1, D4)", () => {
  const card = fortyCard()
  const numbers = shotNumbers(card)
  const seventh = card.findIndex((s) => s.kind === "match" && numbers.get(s) === 7)

  it("ein auf der Scheibe gewählter Wertungsschuss steht im Lineal von Verlauf und Rhythmus", () => {
    const html = renderTab("time", { chosen: { index: seventh, series: 1 } })
    expect(html).toMatch(/data-course-point="7" data-chosen="true"/)
    expect(html).toMatch(/data-interval="7"[^>]*data-chosen="true"/)
    expect(html).toContain("Schuss 7 · ")
  })

  it("„Auf der Scheibe“ nur, wenn die Seite den Rückweg anbietet", () => {
    const chosen = { index: seventh, series: 1 } as const
    expect(renderTab("time", { chosen, onChoose: () => {} })).toContain(">Auf der Scheibe<")
    expect(renderTab("time", { chosen })).not.toContain(">Auf der Scheibe<")
  })
})
