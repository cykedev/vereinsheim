import {
  decimalHistogram,
  longestRun,
  ringDistribution,
  seriesConsistency,
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
import { describe, expect, it } from "vitest"

import { formatValue, percentText } from "../../format"
import { fortyCard } from "../testCard"
import { cardText, renderTab } from "../testPanel"

const CARD = fortyCard()
const BASE = CARD.filter((s) => s.kind === "match")

const render = (
  scoring: "decimal" | "rings" = "decimal",
  shots: readonly MetricShot[] = CARD,
  target: TargetImage = LP_10M
) => renderTab("result", { scoring, shots, target })

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

  it("fehlt einem Schuss der Wert, kein Ergebnis, aber der Ø über die Schüsse mit Wert", () => {
    // die Hilfe sagt „Den Ø gibt es trotzdem“ (Prüfung, Ergebnis 3)
    const blind = BASE.map((s, i) => (i === 5 ? { ...s, decimalTenths: null, ring: null } : s))
    const mean = computeMetric(inScoring(metricByKey("result.decimalMean")!, "decimal"), blind)!
    const text = cardText(render("decimal", blind), "ergebnis")
    expect(text).toContain("Ergebnis – nicht jeder Schuss mit Wert")
    // in Zehnteln zählen die Schüsse mit Zehntel; ein Schuss nur mit Ring hat einen Wert (Review)
    expect(text).toContain(`Ø je Schuss ${formatValue(mean, 2)} über 39 Schuss mit Zehntel`)
    expect(text).toContain("Schuss 40")
  })

  it("fehlen nur Zehntel, rät die Karte zu ganzen Ringen (Prüfung, Ergebnis 4)", () => {
    const tenthless = BASE.map((s, i) => (i === 5 ? { ...s, decimalTenths: null } : s))
    expect(cardText(render("decimal", tenthless), "ergebnis")).toContain(
      "Ergebnis – nicht jeder Schuss mit Zehntel · auf ganze Ringe schalten"
    )
    expect(cardText(render("rings", tenthless), "ergebnis")).toMatch(/Ergebnis \d+ Ringe/)
  })

  it("eine Spanne von genau einem Ring heißt „1 Ring“", () => {
    // Serie 2 einen Ring tiefer: 10 Schuss, einer mit 9 statt 10
    const ones = BASE.slice(0, 20).map((s, i) => ({
      ...s,
      decimalTenths: i === 15 ? 95 : 100,
      ring: i === 15 ? 9 : 10,
    }))
    expect(cardText(render("rings", ones), "serien-und-konstanz")).toContain("Spanne 1 Ring ")
  })

  it("ohne Schuss mit Lage oder Teiler keine Teiler", () => {
    const noPosition = BASE.slice(0, 3).map((s) => ({
      ...s,
      xUm: null,
      yUm: null,
      distanceUm: null,
    }))
    // der gemessene Teiler reicht, die Lage braucht es nicht (Prüfung, Ergebnis 15)
    expect(cardText(render("decimal", noPosition), "extreme-und-teiler")).toContain(
      "ab 1 Schuss mit Teiler"
    )
  })

  it("Zehntelverteilung: eine Säule je belegtem Zehntel, Farbe nach Ring, Achse bis 10,9", () => {
    const hist = decimalHistogram(BASE)
    const card = html.slice(html.indexOf('data-card="zehntelverteilung"'))
    const bars = [...card.matchAll(/data-tenth="(\d+)"[^>]*fill="([^"]+)"/g)]
    expect(bars.map((m) => Number(m[1]))).toEqual(
      hist.counts.flatMap((count, tenth) => (count ? [tenth] : []))
    )
    for (const [, tenth, fill] of bars) {
      expect(fill).toBe(`var(--score-${Math.max(7, Math.min(10, Math.floor(Number(tenth) / 10)))})`)
    }
    expect(cardText(html, "zehntelverteilung")).toContain("10,9")
    expect(cardText(html, "zehntelverteilung")).toContain(
      `höchste Säule ${Math.max(...hist.counts)}`
    )
  })

  it("Zehntelverteilung in ganzen Ringen: der Hinweis zum Umschalten statt Säulen", () => {
    const rings = render("rings")
    expect(cardText(rings, "zehntelverteilung")).toContain("Gibt es nur in der Zehntelwertung")
    expect(rings).not.toContain("data-tenth")
  })

  it("Serien und Konstanz: ein Punkt je Serie mit Wert, Kennzahlen aus dem Fachkern", () => {
    const cons = seriesConsistency(BASE, "decimal")!
    const points = [...html.matchAll(/data-series-point="(\d+)"/g)].map((m) => Number(m[1]))
    expect(points).toEqual(cons.series.filter((p) => p.total !== null).map((p) => p.series))
    const text = cardText(html, "serien-und-konstanz")
    expect(text).toContain(`Verglichen ${cons.compared} von ${cons.series.length} Serien`)
    // „Streuung“ heißt sonst die Gruppe auf der Scheibe (Prüfung, Ergebnis 8)
    expect(text).toContain(`Abweichung der Serien ${formatValue(cons.sd!, 2)} Ringe (SD)`)
    expect(text).toContain(`Spanne ${formatValue(cons.range!, 1)} Ringe`)
    expect(text).toContain(`Abweichung je Schuss ${formatValue(cons.shotSd!, 2)} Ringe (SD)`)
    expect(text).not.toContain("MAD")
    expect(html).not.toMatch(/data-series-point="\d+" data-short/)
  })

  it("Serien: eine kurze Restserie ist hohl und nicht in der Linie", () => {
    const short = render("decimal", BASE.slice(0, 35))
    const cons = seriesConsistency(BASE.slice(0, 35), "decimal")!
    const last = cons.series[cons.series.length - 1]
    expect(last.shots).toBe(5)
    expect(short).toMatch(new RegExp(`data-series-point="${last.series}" data-short="true"`))
    const line = short.match(/data-series-line="true" points="([^"]+)"/)![1]
    expect(line.trim().split(" ")).toHaveLength(cons.series.length - 1)
    expect(cardText(short, "serien-und-konstanz")).toContain(`S${last.series} (5)`)
  })
})
