import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { fortyCard } from "../analysis/testCard"
import { formatValue } from "../format"
import { initialViewState } from "../view-state"
import { CardHeader } from "./CardHeader"

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
const result = (scoring: "decimal" | "rings") =>
  computeMetric(inScoring(metricByKey("result.decimal")!, scoring), CARD)!

describe("Kopf der Scheibe (D2)", () => {
  it("Titel, Metazeile, Ergebnis groß aus dem Fachkern mit Schusszahl, Umschalter, Satz", () => {
    const t = text(render())
    expect(render()).toMatch(/<h1[^>]*>Luftpistole 10 m<\/h1>/)
    expect(t).toContain("40 Schuss mit Probe · 2. Oktober")
    expect(t).toContain(`${formatValue(result("decimal"), 1)} Ringe`)
    // die Schusszahl unter dem Ergebnis, nicht die Metazeile „40 Schuss mit Probe“
    expect(render()).toMatch(/<p class="[^"]*">40 Schuss<\/p>/)
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
})
