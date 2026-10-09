import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { fortyCard } from "../analysis/testCard"
import { formatValue } from "../format"
import { initialViewState } from "../view-state"
import { CardResult, RESULT_FACTS } from "./CardResult"

const CARD = fortyCard()
const render = (props: Partial<Parameters<typeof CardResult>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CardResult, {
      shots: CARD,
      state: initialViewState(),
      scoring: createElement("span", null, "UMSCHALTER"),
      ...props,
    })
  )
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
/** Wert nach einem `<dt>` mit diesem Text */
const valueAfter = (html: string, term: string) =>
  new RegExp(`<dt[^>]*>${term}</dt><dd[^>]*>([^<]*)</dd>`).exec(html)?.[1]
const result = (scoring: "decimal" | "rings") =>
  computeMetric(inScoring(metricByKey("result.decimal")!, scoring), CARD)!

describe("Ergebnis der Scheibe", () => {
  it("groß aus dem Fachkern, darunter die Schusszahl wie am Ausdruck (U4), dazu der Umschalter", () => {
    const html = render()
    expect(text(html)).toContain(`${formatValue(result("decimal"), 1)} Ringe`)
    expect(html).toMatch(/<p class="[^"]*">40 Schuss<\/p>/)
    expect(text(html)).toContain("UMSCHALTER")
  })

  it("in ganzen Ringen das ganzzahlige Ergebnis", () => {
    const t = text(render({ state: initialViewState({ scoring: "rings" }) }))
    expect(t).toContain(`${formatValue(result("rings"), 0)} Ringe`)
  })

  it("Zehner, Innenzehner und bester Teiler aus dem Fachkern, in der gewählten Wertung", () => {
    for (const scoring of ["decimal", "rings"] as const) {
      const html = render({ state: initialViewState({ scoring }) })
      for (const [term, key] of RESULT_FACTS) {
        const metric = inScoring(metricByKey(key)!, scoring)
        const value = computeMetric(metric, CARD)
        expect(value, key).not.toBeNull()
        expect(valueAfter(html, term), `${scoring} ${key}`).toBe(
          formatValue(value!, metric.decimals)
        )
      }
    }
  })

  it("folgt nicht der Auswahl: eine gewählte Serie ändert das Ergebnis nicht", () => {
    expect(render({ state: initialViewState({ selection: 2 }) })).toBe(render())
  })

  it("ohne Probe nur die Wertung; ohne Wert ein Strich mit Grund, ohne Schuss keine Kennzahlen", () => {
    const match = CARD.filter((s) => s.kind === "match")
    expect(render({ shots: match })).toMatch(/<p class="[^"]*">40 Schuss<\/p>/)
    const blind = match.map((s, i) => (i === 20 ? { ...s, decimalTenths: null, ring: null } : s))
    expect(text(render({ shots: blind }))).toContain("– nicht jeder Schuss mit Wert")
    expect(text(render({ shots: [] }))).toContain("– ab 1 Schuss")
    const tenthless = match.map((s, i) => (i === 20 ? { ...s, decimalTenths: null } : s))
    expect(text(render({ shots: tenthless }))).toContain(
      "– nicht jeder Schuss mit Zehntel · auf ganze Ringe schalten"
    )
    expect(render({ shots: [] })).not.toContain("Kennzahlen der Scheibe")
  })
})
