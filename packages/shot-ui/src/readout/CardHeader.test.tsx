import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { fortyCard } from "../analysis/testCard"
import { formatValue } from "../format"
import { initialViewState } from "../view-state"
import { CardHeader, HEADER_FACTS } from "./CardHeader"

const CARD = fortyCard()
const render = (props: Partial<Parameters<typeof CardHeader>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CardHeader, {
      title: "Luftpistole 10 m",
      meta: ["40 Schuss mit Probe", "2. Oktober"],
      shots: CARD,
      state: initialViewState(),
      scoring: createElement("span", null, "UMSCHALTER"),
      sentence: "Die Lage ist echt.",
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

describe("Kopf der Scheibe (D2)", () => {
  it("Titel, Metazeile, Ergebnis groß aus dem Fachkern mit Schusszahl, Umschalter, Satz", () => {
    const t = text(render())
    expect(render()).toMatch(/<h1[^>]*>Luftpistole 10 m<\/h1>/)
    expect(t).toContain("40 Schuss mit Probe · 2. Oktober")
    expect(t).toContain(`${formatValue(result("decimal"), 1)} Ringe`)
    // Wertung und Probe unter dem Ergebnis, nicht die Metazeile „40 Schuss mit Probe“
    expect(render()).toMatch(/<p class="[^"]*">40 Schuss \+ 9 Probe<\/p>/)
    expect(t).toContain("UMSCHALTER")
    expect(t).toContain("Die Lage ist echt.")
  })

  it("in ganzen Ringen das ganzzahlige Ergebnis", () => {
    const t = text(render({ state: initialViewState({ scoring: "rings" }) }))
    expect(t).toContain(`${formatValue(result("rings"), 0)} Ringe`)
  })

  it("ohne Wert ein Strich mit Grund, ohne Satz kein leerer Absatz", () => {
    const blind = CARD.map((s, i) => (i === 20 ? { ...s, decimalTenths: null, ring: null } : s))
    const t = text(render({ shots: blind, sentence: null }))
    expect(t).toContain("– nicht jeder Schuss mit Wert")
    expect(text(render({ shots: [], sentence: null }))).toContain("– ab 1 Schuss")
    expect(render({ sentence: null })).not.toContain("data-sentence")
  })

  it("Zehner, Innenzehner und bester Teiler der ganzen Scheibe aus dem Fachkern, in der gewählten Wertung", () => {
    for (const scoring of ["decimal", "rings"] as const) {
      const html = render({ state: initialViewState({ scoring }) })
      for (const [term, key] of HEADER_FACTS) {
        const metric = inScoring(metricByKey(key)!, scoring)
        const value = computeMetric(metric, CARD)
        expect(value, key).not.toBeNull()
        expect(valueAfter(html, term), `${scoring} ${key}`).toBe(
          formatValue(value!, metric.decimals)
        )
      }
    }
  })

  it("folgt nicht der Auswahl: eine gewählte Serie ändert den Kopf nicht", () => {
    expect(render({ state: initialViewState({ selection: 2 }) })).toBe(render())
  })

  it("ohne Probe nur die Wertung; ohne Wertungsschuss keine Kennzahlen", () => {
    const match = CARD.filter((s) => s.kind === "match")
    expect(render({ shots: match })).toMatch(/<p class="[^"]*">40 Schuss<\/p>/)
    expect(render({ shots: [], sentence: null })).not.toContain("Kennzahlen der Scheibe")
  })
})
