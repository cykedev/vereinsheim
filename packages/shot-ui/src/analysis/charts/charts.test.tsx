import type { SeriesPoint } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { IntervalBar } from "../parts"
import { PathChart } from "./PathChart"
import { SeriesChart } from "./SeriesChart"

const shot = (series: number, xUm: number, yUm: number): MetricShot => ({
  xUm,
  yUm,
  decimalTenths: 100,
  ring: 10,
  innerTen: false,
  firedAtMs: null,
  kind: "match",
  series,
})

/** Beschriftungen der waagrechten Gitterlinien (rechtsbündig links der Achse) */
const gridLabels = (html: string) =>
  [...html.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]+)<\/text>/g)].map((m) => m[1])

describe("Maßstab in kleinen Feldern", () => {
  it("bleibt im Feld, auch wenn die Schwerpunkte der Serien fast zusammenfallen", () => {
    // zwei Serien, deren Schwerpunkte nur 20 µm auseinander liegen
    const shots = [shot(1, 1000, 0), shot(1, -1000, 20), shot(2, 0, 1000), shot(2, 0, -980)]
    const html = renderToStaticMarkup(createElement(PathChart, { width: 600, shots }))
    const line = html.match(/<g data-scale="[^"]+"><line x1="([\d.]+)"[^>]*x2="([\d.]+)"/)!
    expect(Number(line[2]) - Number(line[1])).toBeLessThanOrEqual(260 / 2)
  })

  it("Schrift wie die übrigen Diagramme, Zahl mit Komma aus dem Format", () => {
    const shots = [shot(1, 1000, 0), shot(1, -1000, 0), shot(2, 0, 3000), shot(2, 0, 1000)]
    const html = renderToStaticMarkup(createElement(PathChart, { width: 600, shots }))
    const scale = html.match(/<g data-scale="([^"]+)">.*?<\/g>/)![0]
    expect(scale).not.toContain('font-size="11"')
    expect(scale).toMatch(/>\d+(,\d)? mm<\/text>/)
  })
})

describe("Achse der Serienkurve", () => {
  const series = (totals: number[]): SeriesPoint[] =>
    totals.map((total, i) => ({ series: i + 1, shots: 10, total }))

  it("in Zehnteln höchstens eine Teilung je Zehntel, jede Beschriftung einmal", () => {
    const html = renderToStaticMarkup(
      createElement(SeriesChart, { width: 600, series: series([103.4, 103.5]), digits: 1 })
    )
    const labels = gridLabels(html)
    expect(labels.length).toBeGreaterThan(1)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("in ganzen Ringen nur ganze Ringe an der Achse", () => {
    const html = renderToStaticMarkup(
      createElement(SeriesChart, { width: 600, series: series([95, 96]), digits: 0 })
    )
    const labels = gridLabels(html)
    expect(labels.length).toBeGreaterThan(1)
    for (const label of labels) expect(label).toMatch(/^\d+$/)
  })
})

describe("Intervallbalken", () => {
  it("ohne Spanne (alle Treffer in einem Punkt) kein NaN", () => {
    const html = renderToStaticMarkup(
      createElement(IntervalBar, { value: 0, low: 0, high: 0, min: 0, max: 0, label: "σ 0 mm" })
    )
    expect(html).not.toContain("NaN")
  })
})
