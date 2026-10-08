import type { SeriesPoint } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { IntervalBar } from "../parts"
import { RULER_HINT } from "./ChartRuler"
import { ClockChart } from "./ClockChart"
import { CourseChart } from "./CourseChart"
import { DecimalHistogram } from "./DecimalHistogram"
import { RhythmChart } from "./RhythmChart"
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

/** zwölf Wertungsschüsse mit Zehntelwerten 95, 96, … und Zeit, eine Serie */
const twelve: MetricShot[] = Array.from({ length: 12 }, (_, i) => ({
  seq: i + 1,
  xUm: 100 * i,
  yUm: 0,
  decimalTenths: 95 + (i % 7),
  ring: 9 + Math.floor((95 + (i % 7)) / 100),
  innerTen: false,
  firedAtMs: i * 50_000,
  kind: "match",
  series: 1,
}))

describe("Verlauf mit Lineal", () => {
  const course = (props: Partial<Parameters<typeof CourseChart>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(CourseChart, { width: 600, shots: twelve, scoring: "decimal", ...props })
    )

  it("ohne Wahl der Hinweis, kein Lineal, kein Wert nur im <title>", () => {
    const html = course()
    expect(html).toContain(RULER_HINT)
    expect(html).not.toContain("data-ruler")
    expect(html).not.toContain("<title>")
    expect(html).toContain("touch-action:pan-y")
  })

  it("der auf der Scheibe gewählte Schuss steht im Lineal, die Zeile nennt Wert und Schnitt", () => {
    const html = course({ chosenNumber: 5, onShow: () => {} })
    expect(html).toMatch(/data-course-point="5" data-chosen="true"[^>]*r="5.5"/)
    expect([...html.matchAll(/data-chosen="true"/g)]).toHaveLength(1)
    expect(html).toContain("data-ruler")
    // Schuss 5 hat 99 Zehntel, der Schnitt bisher (noch keine zehn): (95 + 96 + 97 + 98 + 99) / 5 = 97
    expect(html).toContain("Schuss 5 · 9,9 · Schnitt bisher 9,70")
    expect(html).toMatch(/<button type="button"[^>]*>Auf der Scheibe<\/button>/)
  })

  it("ohne Aktion kein Knopf; die Tabelle hat eine Zeile je Schuss", () => {
    const html = course({ chosenNumber: 12 })
    expect(html).not.toContain(">Auf der Scheibe<")
    expect(html).toContain("Schnitt der letzten zehn")
    expect([...html.matchAll(/<tr class="border-t/g)]).toHaveLength(12)
  })
})

describe("Rhythmus mit Lineal", () => {
  // zwölf Schüsse im Abstand von 50 s, vor Schuss 7 eine Pause von vier Minuten
  const paced = twelve.map((s, i) => ({ ...s, firedAtMs: i * 50_000 + (i >= 6 ? 190_000 : 0) }))
  const rhythm = (props: Partial<Parameters<typeof RhythmChart>[0]> = {}) =>
    renderToStaticMarkup(createElement(RhythmChart, { width: 600, shots: paced, ...props }))

  it("ohne Wahl der Hinweis, kein <title>, eine Tabellenzeile je Abstand", () => {
    const html = rhythm()
    expect(html).toContain(RULER_HINT)
    expect(html).not.toContain("<title>")
    expect([...html.matchAll(/<tr class="border-t/g)]).toHaveLength(11)
  })

  it("das Lineal steht auf dem Abstand vor dem gewählten Schuss, die Pause heißt so", () => {
    const html = rhythm({ chosenNumber: 7, onShow: () => {} })
    expect(html).toMatch(/data-interval="7" data-pause="true" data-chosen="true"/)
    expect(html).toContain("vor Schuss 7: 4:00 min (Pause)")
    expect(html).toContain("data-ruler")
    expect(html).toMatch(/<button type="button"[^>]*>Auf der Scheibe<\/button>/)
  })
})

describe("Zehntel-Säulen und Richtungsuhr: Werte als Tabelle", () => {
  it("Säulen: Hinweis im Lineal, eine Tabellenzeile je belegtem Zehntel, kein <title>", () => {
    const counts = Array.from({ length: 110 }, (_, t) =>
      t === 97 ? 3 : t === 104 ? 5 : t === 108 ? 1 : 0
    )
    const html = renderToStaticMarkup(
      createElement(DecimalHistogram, { width: 600, hist: { n: 9, counts } })
    )
    expect(html).toContain(RULER_HINT)
    expect(html).not.toContain("<title>")
    const rows = [
      ...html.matchAll(/<tr class="border-t[^>]*><td[^>]*>([^<]+)<\/td><td[^>]*>(\d+)<\/td>/g),
    ].map((m) => `${m[1]}:${m[2]}`)
    expect(rows).toEqual(["9,7:3", "10,4:5", "10,8:1"])
  })

  it("Richtungsuhr: eine Tabellenzeile je belegter Stunde, 12 statt 0, kein <title>", () => {
    const counts = [2, 0, 0, 4, 0, 0, 0, 0, 0, 1, 0, 0]
    const html = renderToStaticMarkup(createElement(ClockChart, { width: 600, counts }))
    expect(html).not.toContain("<title>")
    const rows = [
      ...html.matchAll(/<tr class="border-t[^>]*><td[^>]*>([^<]+)<\/td><td[^>]*>(\d+)<\/td>/g),
    ].map((m) => `${m[1]}:${m[2]}`)
    expect(rows).toEqual(["12 Uhr:2", "3 Uhr:4", "9 Uhr:1"])
  })
})
