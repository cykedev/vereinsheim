import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { directionText, formatValue } from "../format"
import { selectionShots } from "../shots"
import { initialViewState, type ViewState } from "../view-state"
import { MetricTiles, TILE_KEYS } from "./MetricTiles"

const shot = (
  kind: "probe" | "match",
  series: number | null,
  xUm: number,
  yUm: number,
  tenths: number,
  firedAtMs: number | null = null
): MetricShot => ({
  xUm,
  yUm,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs,
  kind,
  series,
})

// zwei Probeschüsse, Serie 1 mit drei Schuss (mit Zeiten), Serie 2 mit drei Schuss weiter rechts
const CARD = [
  shot("probe", null, 14000, -9000, 96),
  shot("probe", null, 1000, 2000, 104),
  shot("match", 1, 0, 0, 109, 0),
  shot("match", 1, 2000, 1000, 105, 40_000),
  shot("match", 1, -1500, 2500, 103, 85_000),
  shot("match", 2, 9000, -2000, 98),
  shot("match", 2, 8500, -1500, 99),
  shot("match", 2, 10000, -3000, 97),
]

const render = (state: Partial<ViewState> = {}, onHelp?: (key: string) => void) =>
  renderToStaticMarkup(
    createElement(MetricTiles, { shots: CARD, state: { ...initialViewState(), ...state }, onHelp })
  )

/** Text einer Kachel (data-metric) ohne Markup */
const tileText = (html: string, key: string) => {
  // erst nach dem öffnenden Tag: Attribute wie title zählen nicht als sichtbarer Text
  const start = html.indexOf(">", html.indexOf(`data-metric="${key}"`)) + 1
  const end = html.indexOf("data-metric=", start)
  return html
    .slice(start, end < 0 ? undefined : end)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
}

const expected = (key: string, shots: readonly MetricShot[], scoring: "decimal" | "rings") => {
  const metric = inScoring(metricByKey(key)!, scoring)
  const value = computeMetric(metric, shots)
  return value === null ? "–" : formatValue(value, metric.decimals)
}

describe("Kacheln „Trefferbild in Zahlen“", () => {
  it("zehn Kacheln in der Reihenfolge der Spielwiese", () => {
    const keys = [...render().matchAll(/data-metric="([^"]+)"/g)].map((m) => m[1])
    expect(keys).toEqual([...TILE_KEYS])
    expect(keys).toHaveLength(10)
  })

  it("Werte aus dem Fachkern über die Wertung, in der gewählten Wertung", () => {
    const all = selectionShots(CARD, "all")
    for (const scoring of ["decimal", "rings"] as const) {
      const html = render({ scoring })
      for (const key of ["group.sigma", "result.decimalMean", "group.enclosingDiameter"]) {
        expect(tileText(html, key), key).toContain(expected(key, all, scoring))
      }
    }
  })

  it("folgen der Auswahl: Serie 2 rechnet nur mit Serie 2", () => {
    const html = render({ selection: 2 })
    const series2 = selectionShots(CARD, 2)
    expect(series2).toHaveLength(3)
    expect(tileText(html, "group.mpiDistance")).toContain(
      expected("group.mpiDistance", series2, "decimal")
    )
    expect(expected("group.mpiDistance", series2, "decimal")).not.toBe(
      expected("group.mpiDistance", selectionShots(CARD, "all"), "decimal")
    )
    expect(html).toMatch(/<h2[^>]*>Trefferbild in Zahlen<\/h2>[\s\S]*?Serie 2/)
  })

  it("ohne Wert ein Strich und die Mindestzahl", () => {
    // Serie 2 hat keine Zeiten: kein Tempo
    const text = tileText(render({ selection: 2 }), "time.intervalMedian")
    expect(text).toContain("–")
    expect(text).toContain(`ab ${metricByKey("time.intervalMedian")!.minShots} Schuss`)
  })

  it("der Kurzsatz aus shot-help steht als Titel an jeder Kachel", () => {
    const html = render()
    for (const key of TILE_KEYS) {
      const short = helpForMetric(key)?.short
      expect(short, key).toBeTruthy()
      expect(html).toContain(`title="${short}"`)
    }
  })

  it("σ bleibt klein, auch in der Großschrift der Beschriftung", () => {
    expect(render()).toContain('<span class="normal-case">σ</span>')
  })

  it("Schwerpunkt mit Richtung in Worten", () => {
    expect(directionText({ xUm: 2500, yUm: -1200 })).toBe("2,5 rechts · 1,2 tief (mm)")
    expect(directionText({ xUm: 30, yUm: -40 })).toBe("mittig")
  })

  it("an jeder Kachel ein „?“ für die Erklärung, wenn es eine gibt", () => {
    const html = render({}, () => {})
    expect([...html.matchAll(/<button[^>]*aria-label="Erklärung: [^"]+"/g)]).toHaveLength(10)
    expect(render()).not.toContain("Erklärung:")
  })

  it("mit „Erklärungen“ steht der Kurzsatz sichtbar an der Kachel, nicht nur als Tooltip", () => {
    const html = renderToStaticMarkup(
      createElement(MetricTiles, { shots: CARD, state: initialViewState(), explain: true })
    )
    for (const key of TILE_KEYS) {
      expect(tileText(html, key), key).toContain(helpForMetric(key)!.short)
    }
    expect(render()).not.toContain("data-short")
  })

  it("ein Schalter im Kopf, rechts neben der Auswahl", () => {
    const html = renderToStaticMarkup(
      createElement(MetricTiles, {
        shots: CARD,
        state: initialViewState(),
        action: createElement("button", { type: "button" }, "Erklärungen"),
      })
    )
    expect(html).toMatch(
      /<\/h2>[\s\S]*alle Wertungsschüsse[\s\S]*>Erklärungen<\/button>[\s\S]*data-metric=/
    )
  })
})
