import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SumSeries } from "./SumSeries"

const SERIES = [
  { series: 1, shots: 10, rings: 88, decimalTenths: 921 },
  { series: 2, shots: 10, rings: 86, decimalTenths: 905 },
  { series: 3, shots: 10, rings: 90, decimalTenths: null },
  { series: 4, shots: 8, rings: 70, decimalTenths: 760 },
]
const render = (scoring: "decimal" | "rings") =>
  renderToStaticMarkup(createElement(SumSeries, { target: LP_10M, series: SERIES, scoring }))

describe("Serien aus Summen", () => {
  it("je Serie eine Kachel mit dem leisen Platzhalter als kleiner Scheibe, ohne Schalter und ohne Mitte", () => {
    const html = render("decimal")
    expect(html).toMatch(/^<div data-sum-series="true"/)
    expect(html.match(/data-series="/g)).toHaveLength(4)
    expect(html.match(/<svg [^>]*data-mini-placeholder="true"/g)).toHaveLength(4)
    expect(html).not.toContain("<circle cx=")
    expect(html).not.toContain("data-summary-center")
    expect(html).not.toContain("<button")
  })

  it("in Zehnteln der Wert mit einer Stelle, eine Summe nur in Ringen „–“ mit „ohne Zehntel“", () => {
    const html = render("decimal")
    expect(html).toContain(">92,1<")
    expect(html).toContain(
      '<span title="ohne Zehntel">–<span class="sr-only"> ohne Zehntel</span></span>'
    )
    expect(html).toContain("8 von 10 Schuss")
  })

  it("in ganzen Ringen ohne Stelle", () => {
    const html = render("rings")
    expect(html).toContain(">88<")
    expect(html).not.toContain("ohne Zehntel")
  })
})
