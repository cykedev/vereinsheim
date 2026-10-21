import { describe, expect, it } from "vitest"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { periodModel } from "./model"
import type { PatternState } from "./PatternPanel"
import { PeriodAnalysis, type PeriodAnalysisProps } from "./PeriodAnalysis"
import { RecordsCard } from "./PeriodInsights"
import { positionHalfMm } from "./PositionChart"
import { initialPeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"

const model = periodModel({
  items: [9, 10, 8, 10, 9, 11].map((v, i) =>
    item(periodCard(`k${i}`, 30 - 3 * i, [v * 10, v * 10 + 3, v * 10 - 2]))
  ),
  state: initialPeriodState({ family: "lg-10m" }),
  nowMs: NOW,
  timeZone: TZ,
  named: [],
})

/** zwölf Scheiben zu 40 Schuss um (400 | −300) µm, je auf Ringen um ihre Mitte */
const cards: PatternCard[] = Array.from({ length: 12 }, (_, c) => ({
  id: `k${c}`,
  atMs: c,
  points: Array.from({ length: 40 }, (_, i) => {
    const r = 400 + ((i * 7) % 5) * 300
    const a = (i * 2 * Math.PI) / 40 + c
    return {
      xUm: 400 + ((c % 3) - 1) * 20 + Math.round(r * Math.cos(a)),
      yUm: -300 + ((c % 2) * 2 - 1) * 20 + Math.round(r * Math.sin(a)),
    }
  }),
}))
const ready: PatternState = { status: "ready", pattern: periodPattern(cards) }

const render = (props: Partial<PeriodAnalysisProps>) =>
  renderToStaticMarkup(
    h(PeriodAnalysis, {
      tab: "result",
      onTab: () => {},
      model,
      scoring: "decimal",
      timeZone: TZ,
      target: LG_10M,
      pattern: ready,
      onRetry: () => {},
      explain: false,
      ...props,
    })
  )

describe("PeriodAnalysis", () => {
  it("drei Reiter in der Ordnung der Scheibe", () => {
    const html = render({})
    expect([...html.matchAll(/role="radio"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual([
      "Ergebnis",
      "Präzision",
      "Lage",
    ])
  })

  it("Ergebnis: die Rekorde wie bisher", () => {
    const html = render({ tab: "result" })
    const records = renderToStaticMarkup(
      h(RecordsCard, { model, scoring: "decimal", timeZone: TZ, explain: false })
    )
    expect(html).toContain(records)
  })

  it("Präzision: Form mit Länge zu Breite, Streuung und Grundlage", () => {
    const html = render({ tab: "precision" })
    expect(html).toContain('data-card="form-ueber-scheiben"')
    expect(html).toContain("Länge zu Breite")
    expect(html).toContain("Gerechnet über 480 Schuss aus 12 Scheiben, jede um ihre eigene Mitte.")
  })

  it("Lage: Schwerpunkte mit Urteil, die gewählte hervorgehoben, Ausreißerrichtung", () => {
    const html = render({ tab: "position", chosen: "k3" })
    expect(html.match(/data-position-card=/g)).toHaveLength(12)
    expect(html).toContain('data-position-card="k3" aria-current="true"')
    expect(html).toContain("Deine Lage ist versetzt: rechts tief, im Mittel 0,5 mm.")
    expect(html).toContain('data-card="ausreisserrichtung"')
    expect(html).toContain("Gezählt ist je Scheibe das weiteste Zehntel der Schüsse")
  })

  it("lädt das Muster noch oder ging es schief, sagen Präzision und Lage es", () => {
    expect(render({ tab: "precision", pattern: { status: "loading" } })).toContain(
      "Trefferbild wird gerechnet …"
    )
    const failed = render({ tab: "position", pattern: { status: "error" } })
    expect(failed).toContain("Das Trefferbild ließ sich nicht laden.")
    expect(failed).toContain("Noch einmal")
  })
})

describe("positionHalfMm", () => {
  it("alle Schwerpunkte mit Rand, mindestens 1,5 mm", () => {
    const at = (xUm: number, yUm: number) => ({ id: "a", atMs: 0, center: { xUm, yUm }, n: 40 })
    expect(positionHalfMm({ points: [at(100, 0)] })).toBe(1.5)
    expect(positionHalfMm({ points: [at(3000, 4000)] })).toBeCloseTo(6.25, 6)
  })
})
