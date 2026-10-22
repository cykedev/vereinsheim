import { describe, expect, it } from "vitest"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { periodPattern, type PatternCard } from "@vereinsheim/shot-core/analysis"

import { periodModel } from "./model"
import type { PatternState } from "./PatternPanel"
import { PeriodAnalysis, type PeriodAnalysisProps } from "./PeriodAnalysis"
import { RecordsCard } from "./PeriodInsights"
import { timelineLimit, trailingMean } from "./PositionTimeline"
import { shapeAxes } from "./ShapeEllipse"
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

  it("Präzision: die Form als Ellipse mit dem runden Kreis, Länge zu Breite, Streuung und Grundlage", () => {
    const html = render({ tab: "precision" })
    expect(html).toContain('data-card="form-ueber-scheiben"')
    expect(html).toContain("data-shape-ellipse")
    expect(html).toContain("data-shape-round")
    expect(html).toContain("Länge zu Breite")
    expect(html).toContain("Gestrichelt: So sähe eine runde Gruppe mit derselben Streuung aus.")
    expect(html).toContain("Gerechnet über 480 Schuss aus 12 Scheiben, jede um ihre eigene Mitte.")
  })

  it("Lage: zwei Zeitreihen mit Urteil, Ausreißerrichtung", () => {
    const html = render({ tab: "position", chosen: "k3" })
    expect(html).toContain('data-timeline-row="x"')
    expect(html).toContain('data-timeline-row="y"')
    expect(html).toContain("Deine Lage ist versetzt: rechts tief, im Mittel 0,5 mm.")
    expect(html).toContain("Jeder Punkt ist eine Scheibe, die Linie der Schnitt der letzten fünf.")
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

describe("Hilfen der Bilder", () => {
  it("Halbachsen aus Streuung und Länge zu Breite", () => {
    const { majorUm, minorUm } = shapeAxes({ sigmaUm: 1000, ratio: 2 })
    expect(majorUm / minorUm).toBeCloseTo(2, 9)
    expect((majorUm ** 2 + minorUm ** 2) / 2).toBeCloseTo(1000 ** 2, 6)
  })

  it("Schnitt der letzten fünf, am Anfang über so viele, wie es gibt", () => {
    const even = [1, 2, 3, 4, 5, 6].map((value) => ({ value, n: 40 }))
    expect(trailingMean(even)).toEqual([1, 1.5, 2, 2.5, 3, 4])
  })

  it("Schnitt über die Schüsse: eine Scheibe mit 40 Schuss zählt viermal so viel wie eine mit 10", () => {
    expect(
      trailingMean([
        { value: 0, n: 10 },
        { value: 1000, n: 40 },
      ])
    ).toEqual([0, 800])
  })

  it("die Höhe der Zeitreihen folgt neun von zehn Scheiben, eine weit draußen staucht sie nicht", () => {
    const at = (xUm: number) => ({ id: "a", atMs: 0, center: { xUm, yUm: 0 }, n: 40 })
    const points = [...Array.from({ length: 10 }, () => at(800)), at(9000)]
    expect(timelineLimit(points)).toBe(2000)
    expect(timelineLimit([at(100)])).toBe(500)
  })
})
