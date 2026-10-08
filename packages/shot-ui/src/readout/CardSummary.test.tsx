import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatValue } from "../format"
import { initialViewState, type ViewState } from "../view-state"
import { CardSummary, SUMMARY_KEYS } from "./CardSummary"

const shot = (
  kind: "probe" | "match",
  series: number | null,
  xUm: number,
  tenths: number,
  innerTen = false
): MetricShot => ({
  xUm,
  yUm: 0,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  innerTen,
  firedAtMs: null,
  kind,
  series,
})

// zwei Probeschüsse, Serie 1 mit drei, Serie 2 mit zwei Schuss
const CARD = [
  shot("probe", null, 9000, 98),
  shot("probe", null, 400, 107),
  shot("match", 1, 200, 108, true),
  shot("match", 1, 3100, 101),
  shot("match", 1, 5800, 96),
  shot("match", 2, 900, 106),
  shot("match", 2, 2000, 104),
]

const render = (state: Partial<ViewState> = {}) =>
  renderToStaticMarkup(
    createElement(CardSummary, { shots: CARD, state: { ...initialViewState(), ...state } })
  )

/** Wert nach einem `<dt>` mit diesem Text */
const valueAfter = (html: string, term: string) =>
  new RegExp(`<dt[^>]*>${term}</dt><dd[^>]*>([^<]*)</dd>`).exec(html)?.[1]

describe("CardSummary: Übersicht der ganzen Scheibe", () => {
  it("Wertungsschüsse und Probe gezählt", () => {
    expect(valueAfter(render(), "Wertung")).toBe("5 Schuss + 2 Probe")
  })

  it("Ergebnis, Zehner, Innenzehner und bester Teiler aus dem Fachkern, in der gewählten Wertung", () => {
    for (const scoring of ["decimal", "rings"] as const) {
      const html = render({ scoring })
      for (const [term, key] of SUMMARY_KEYS) {
        const metric = inScoring(metricByKey(key)!, scoring)
        const value = computeMetric(metric, CARD)
        expect(value, key).not.toBeNull()
        expect(valueAfter(html, term), `${scoring} ${key}`).toBe(
          formatValue(value!, metric.decimals)
        )
      }
    }
  })

  it("Ergebnis in Zehnteln mit Komma, in ganzen Ringen ohne", () => {
    expect(valueAfter(render(), "Ergebnis")).toBe("51,5")
    expect(valueAfter(render({ scoring: "rings" }), "Ergebnis")).toBe("49")
  })

  it("bleibt die ganze Scheibe, auch wenn eine Serie gewählt ist", () => {
    expect(render({ selection: 2 })).toBe(render())
  })

  it("ohne Wertungsschüsse ein Strich", () => {
    const html = renderToStaticMarkup(
      createElement(CardSummary, { shots: CARD.slice(0, 2), state: initialViewState() })
    )
    expect(valueAfter(html, "Wertung")).toBe("0 Schuss + 2 Probe")
    expect(valueAfter(html, "Ergebnis")).toBe("–")
  })
})
