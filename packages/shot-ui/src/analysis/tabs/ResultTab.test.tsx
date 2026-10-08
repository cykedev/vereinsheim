import {
  longestRun,
  ringDistribution,
  shareAtLeast,
  shotExtremes,
} from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { LG_10M, LP_10M, type TargetImage } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatValue, percentText } from "../../format"
import { initialViewState } from "../../view-state"
import { AnalysisPanel } from "../AnalysisPanel"
import { fortyCard } from "../testCard"

const CARD = fortyCard()
const BASE = CARD.filter((s) => s.kind === "match")

const render = (
  scoring: "decimal" | "rings" = "decimal",
  shots: readonly MetricShot[] = CARD,
  target: TargetImage = LP_10M
) =>
  renderToStaticMarkup(
    createElement(AnalysisPanel, {
      shots,
      state: initialViewState({ scoring }),
      target,
      tab: "result",
      onTab: () => {},
      explain: false,
      onToggleLayer: () => {},
    })
  )

/** Text einer Karte (data-card) ohne Markup */
const cardText = (html: string, id: string) => {
  const start = html.indexOf(`data-card="${id}"`)
  const end = html.indexOf("</article>", start)
  return html
    .slice(start, end)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
}

describe("Reiter Ergebnis", () => {
  const html = render()

  it("Ergebnis, Ø je Schuss und Schusszahl aus dem Fachkern", () => {
    const mean = computeMetric(inScoring(metricByKey("result.decimalMean")!, "decimal"), BASE)!
    const text = cardText(html, "ergebnis")
    expect(text).toContain("Ergebnis 365,2 Ringe")
    expect(text).toContain(`Ø je Schuss ${formatValue(mean, 2)}`)
    expect(text).toContain("Schuss 40")
  })

  it("Ringverteilung: eine Zeile je Ring von 10 abwärts, Balken nach Anzahl, Farbe nach Ring", () => {
    const dist = ringDistribution(BASE)
    const rows = [...html.matchAll(/data-ring-row="(\d+)"/g)].map((m) => Number(m[1]))
    const lowest = Math.min(...dist.counts.flatMap((c, ring) => (c && ring > 0 ? [ring] : [10])))
    const expected = []
    for (let ring = 10; ring >= Math.min(lowest, 8); ring--) expected.push(ring)
    if (dist.counts[0]) expected.push(0)
    expect(rows).toEqual(expected)
    const top = Math.max(...dist.counts)
    expect(html).toMatch(
      new RegExp(
        `data-ring-row="10"[\\s\\S]*?style="width:${(dist.counts[10] / top) * 100}%;background:var\\(--score-10\\)"`
      )
    )
    expect(cardText(html, "ringverteilung")).toContain(
      `${dist.innerTens} Innenzehner · n = ${dist.n}`
    )
  })

  it("beste und weiteste Teiler mit Schussnummer", () => {
    const extremes = shotExtremes(BASE)!
    const text = cardText(html, "extreme-und-teiler")
    for (const ref of extremes.bestTeiler)
      expect(text).toContain(`${formatValue(ref.teiler, 1)} (${ref.number})`)
    for (const ref of extremes.widestTeiler)
      expect(text).toContain(`${formatValue(ref.teiler, 1)} (${ref.number})`)
  })

  it("Quoten: zwei Schwellen mit 95-%-Bereich und die längste Folge", () => {
    expect([...html.matchAll(/data-share="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "ab 10,0",
      "ab 9,0",
    ])
    const tens = shareAtLeast(BASE, "decimal", 100)!
    expect(cardText(html, "quoten")).toContain(
      `${percentText(tens.rate)} · ${tens.count}/${tens.n}`
    )
    const run = longestRun(BASE, "decimal", 100)
    expect(cardText(html, "quoten")).toContain(
      `Längste Folge ab 10,0: ${run.length} Schuss ab Schuss ${run.start}`
    )
  })

  it("Schwellen je Wertung und Scheibe: ganze Ringe, Luftgewehr", () => {
    const rings = render("rings")
    expect([...rings.matchAll(/data-share="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "Ring 10",
      "ab Ring 9",
    ])
    expect(cardText(rings, "ergebnis")).toMatch(/Ergebnis \d+ Ringe/)
    const lg = render("decimal", fortyCard(LG_10M), LG_10M)
    expect([...lg.matchAll(/data-share="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "ab 10,0",
      "ab 10,5",
    ])
  })

  it("nur Probe: alle Karten über die Probeschüsse", () => {
    const probes = BASE.map((s) => ({ ...s, kind: "probe" as const, series: null }))
    const text = render("decimal", probes)
    expect(cardText(text, "ergebnis")).toContain("Ergebnis 365,2 Ringe")
    expect(cardText(text, "ringverteilung")).toContain("n = 40")
    expect(cardText(text, "extreme-und-teiler")).not.toContain("ab 1 Schuss")
    expect(cardText(text, "quoten")).toMatch(/· \d+\/40/)
  })

  it("ohne Schuss mit Lage keine Teiler", () => {
    const noPosition = BASE.slice(0, 3).map((s) => ({
      ...s,
      xUm: null,
      yUm: null,
      distanceUm: null,
    }))
    expect(cardText(render("decimal", noPosition), "extreme-und-teiler")).toContain(
      "ab 1 Schuss mit Lage"
    )
  })
})
