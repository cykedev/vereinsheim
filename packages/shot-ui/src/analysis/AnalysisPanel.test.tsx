import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { FALLACIES } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { probeOnlyAsMatch } from "../shots"
import { initialViewState } from "../view-state"
import { AnalysisPanel, ANALYSIS_TABS } from "./AnalysisPanel"
import { analysisInput } from "./input"

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
      ...extra,
    })
  )

describe("analysisInput: worüber die Analyse rechnet", () => {
  it("mit Wertung über alle Schüsse ohne Probe", () => {
    const input = analysisInput(CARD, "decimal", LP_10M)
    expect(input.base).toEqual(CARD.slice(2))
    expect(input.all).toBe(CARD)
    expect(input.basis).toBe("ohne Probe")
  })

  it("nur Probe: über alle Probeschüsse, auch ohne probeOnlyAsMatch der Seite", () => {
    const probes = CARD.slice(0, 2)
    const input = analysisInput(probes, "decimal", LP_10M)
    expect(input.base).toHaveLength(2)
    expect(input.base.every((s) => s.kind === "match")).toBe(true)
    expect(input.basis).toBe("nur Probe")
    // schon umgedeutet: dasselbe
    expect(analysisInput(probeOnlyAsMatch(probes), "decimal", LP_10M).basis).toBe("nur Probe")
  })

  it("nur Wertung: über alle Schüsse", () => {
    expect(analysisInput(CARD.slice(2), "decimal", LP_10M).basis).toBe("alle")
  })
})

describe("AnalysisPanel", () => {
  it("sechs Reiter in der Reihenfolge der Spielwiese", () => {
    const html = render(CARD)
    const labels = [...html.matchAll(/<button[^>]*role="radio"[^>]*>([^<]+)<\/button>/g)].map(
      (m) => m[1]
    )
    expect(labels).toEqual(ANALYSIS_TABS.map((t) => t.label))
    expect(labels).toEqual([
      "Überblick",
      "Ergebnis",
      "Präzision",
      "Lage",
      "Zeit und Verlauf",
      "Probe",
    ])
    expect(html).toContain('aria-label="Thema"')
  })

  it("der Kopf nennt die Grundlage", () => {
    expect(render(CARD)).toContain("über alle Schüsse ohne Probe")
    expect(render(CARD.slice(0, 2))).toContain("über alle Probeschüsse")
    expect(render(probeOnlyAsMatch(CARD.slice(0, 2)))).toContain("über alle Probeschüsse")
    expect(render(CARD.slice(2))).toContain("Analyse über alle Schüsse<")
  })

  it("Datenlage unter jedem Reiter, mit Merkmalen in Worten und der Wertung", () => {
    const flagged = [...CARD, shot(6, "match", 0, 200_000, ["verdaechtig"])]
    const text = render(flagged)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
    expect(text).toContain(
      "Datenlage: 4 Wertung · 2 Probe · 1 ohne Zeit · 1 verdächtig · Wertung in Zehnteln"
    )
    expect(render(CARD.slice(0, 1).map((s) => ({ ...s, firedAtMs: 0 })))).toContain(
      "alle mit Lage, Zeit und Wert"
    )
    expect(render(CARD, { state: initialViewState({ scoring: "rings" }) })).toContain(
      "Wertung in ganzen Ringen"
    )
    expect(render(CARD)).toMatch(/<details data-help="datenlage"/)
  })

  it("auf einer Trainingskarte zählt die Datenlage die Probe als Probe", () => {
    const text = render(probeOnlyAsMatch(CARD.slice(0, 2)))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
    expect(text).toContain("Datenlage: 0 Wertung · 2 Probe")
  })

  it("Glossar und typische Fehlschlüsse aus dem Paket, mit dem Schalter offen", () => {
    const html = render(CARD)
    expect([...html.matchAll(/<dt[^>]*data-term="true"[^>]*>/g)]).toHaveLength(GLOSSARY.length)
    for (const entry of GLOSSARY) expect(html).toContain(entry.term)
    expect([...html.matchAll(/<li[^>]*data-fallacy="true"/g)]).toHaveLength(FALLACIES.length)
    expect(html).toMatch(/<details data-glossary="true"(?! open)/)
    expect(render(CARD, { explain: true })).toMatch(/<details data-glossary="true" open=""/)
  })

  it("ohne Schüsse eine Karte, die sagt, was fehlt", () => {
    expect(render([])).toContain("Noch keine Schüsse auf dieser Scheibe.")
    // keine Datenlage, die „alle mit Lage, Zeit und Wert“ behauptet
    expect(render([])).not.toContain("data-coverage")
  })
})
