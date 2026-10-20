import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { FormStrip } from "./FormStrip"

// sieben Scheiben in zeitlicher Folge, die letzten beiden am Abend; das Band ab der dritten
const values = [8.7, 9.1, 8.9, 9.0, 8.8, 8.94, 9.25]
const strip = values.map((value, i) => ({
  id: `c${i}`,
  value,
  tonight: i >= 5,
  mean: 8.9 + i * 0.01,
  partial: false,
  band: i >= 2 ? { low: 8.72 + i * 0.01, high: 9.08 + i * 0.01 } : null,
}))
const render = (props: Partial<Parameters<typeof FormStrip>[0]> = {}) =>
  renderToStaticMarkup(
    h(FormStrip, { strip, band: strip.at(-1)!.band, dateLabel: "Sa 26.09.", ...props })
  )
const html = render()
const cx = (markup: string) =>
  [...markup.matchAll(/<circle[^>]*data-strip-dot="([^"]+)"[^>]*cx="([0-9.]+)"/g)].map((m) => ({
    id: m[1],
    x: Number(m[2]),
  }))

describe("Formband als kleiner Verlauf", () => {
  it("die Scheiben in zeitlicher Folge von links nach rechts, die des Abends groß und rechts", () => {
    const dots = cx(html)
    expect(dots.map((d) => d.id)).toEqual(strip.map((s) => s.id))
    expect(dots.every((d, i) => !i || d.x > dots[i - 1].x)).toBe(true)
    const tonight = [...html.matchAll(/<circle[^>]*data-tonight="true"[^>]*>/g)].map((m) => m[0])
    expect(tonight).toHaveLength(2)
    for (const dot of tonight) expect(dot).toMatch(/class="[^"]*fill-primary/)
  })

  it("höherer Wert weiter oben: die y-Achse ist der Ø je Schuss", () => {
    const y = (id: string) =>
      Number(new RegExp(`data-strip-dot="${id}"[^>]*cy="([0-9.]+)"`).exec(html)?.[1])
    // c6 (9,25) liegt über c0 (8,70)
    expect(y("c6")).toBeLessThan(y("c0"))
  })

  it("das Datum des Abends statt „Abend“, über seinen Scheiben", () => {
    expect(html).toMatch(/<text[^>]*data-evening-label="true"[^>]*>Sa 26\.09\.<\/text>/)
    expect(html).not.toContain(">Abend<")
  })

  it("das Band als Fläche um den gleitenden Schnitt, der als Linie; keine Linie „Schnitt“", () => {
    expect(html).toMatch(/<path[^>]*data-band="true"/)
    expect(html).toMatch(/<polyline[^>]*data-mean="true"/)
    expect(html).not.toContain("data-average")
    expect(html).not.toContain(">Schnitt ")
    const bare = render({
      strip: strip.map((s) => ({ ...s, band: null })),
      band: null,
    })
    expect(bare).not.toContain("data-band")
    expect(bare).toContain("data-mean")
  })

  it("der Name sagt Folge, Abend und Band in Worten", () => {
    expect(html).toContain(
      'aria-label="Die letzten 7 Scheiben in zeitlicher Folge, die des Abends (Sa 26.09.) hervorgehoben. Formband zuletzt 8,78 bis 9,14"'
    )
    const one = renderToStaticMarkup(
      h(FormStrip, {
        strip: [{ id: "x", value: 10.22, tonight: true, mean: 10.22, partial: true, band: null }],
        band: null,
        dateLabel: "Sa 26.09.",
      })
    )
    expect(one).toContain(
      'aria-label="Die letzte Scheibe, die des Abends (Sa 26.09.) hervorgehoben"'
    )
  })

  it("ein Rahmen um den Verlauf, hinter Band und Punkten; höchster und tiefster Wert als Achse", () => {
    expect(html).toMatch(/<rect data-track="true"[^>]*class="fill-surface-2 stroke-border"/)
    expect(html.indexOf("data-track")).toBeLessThan(html.indexOf("data-band"))
    expect(html.indexOf("data-track")).toBeLessThan(html.indexOf("data-strip-dot"))
    expect(html).toContain(">9,25<")
    expect(html).toContain(">8,70<")
  })

  it("die Achse zeigt einen Wert nur einmal und nie übereinander", () => {
    const flat = strip.map((s, i) => ({ ...s, value: i % 2 ? 9.21 : 9.2, mean: 9.205, band: null }))
    const close = render({ strip: flat, band: null })
    expect(close).toContain(">9,21<")
    expect(close).not.toContain(">9,20<")
    const same = strip.map((s, i) => ({
      ...s,
      value: 9.2041 + (i % 2) * 0.0003,
      mean: 9.2042,
      band: null,
    }))
    expect(render({ strip: same, band: null }).match(/>9,20</g)).toHaveLength(1)
  })

  it("der Schnitt, solange es noch keine fünf Scheiben sind, gestrichelt wie im Fortschritt", () => {
    const partial = strip.map((s, i) => ({ ...s, partial: i < 4 }))
    const html2 = render({ strip: partial })
    expect(html2).toMatch(/<polyline[^>]*data-mean="partial"[^>]*stroke-dasharray/)
    expect(html2).toMatch(/<polyline[^>]*data-mean="true"/)
  })

  it("nur Tokens, keine Palette-Klassen", () => {
    expect(html).not.toMatch(/\b(text|bg|fill|stroke)-(red|green|blue|amber|slate|gray)-\d/)
  })
})
