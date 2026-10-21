import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { comparePicture } from "@vereinsheim/shot-core/analysis"
import type { Point } from "@vereinsheim/shot-core/geometry"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { ComparePicture } from "./ComparePicture"

/** gleichmäßig auf Ringen verteilte Punkte um (x | y), ohne Zufall */
const ring = (n: number, base: Point = { xUm: 0, yUm: 0 }): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const r = 400 + ((i * 7) % 5) * 300
    const a = (i * 2 * Math.PI) / n
    return {
      xUm: base.xUm + Math.round(r * Math.cos(a)),
      yUm: base.yUm + Math.round(r * Math.sin(a)),
    }
  })

const render = (a: Point[], b: Point[]) =>
  renderToStaticMarkup(
    createElement(ComparePicture, { picture: comparePicture(a, b), target: LG_10M, label: "Satz" })
  )

describe("ComparePicture", () => {
  it("ab 50 Schuss je Seite: je Seite zwei Umrisse, einer gestrichelt, A getönt, B zuerst", () => {
    const html = render(ring(60), ring(60, { xUm: 800, yUm: 0 }))
    expect(html).toContain('data-compare-picture="outlines"')
    expect(html.match(/data-compare-outline="/g)).toHaveLength(4)
    expect(html.match(/data-dashed="true"/g)).toHaveLength(2)
    expect(html.indexOf('data-compare-outline="b"')).toBeLessThan(
      html.indexOf('data-compare-outline="a"')
    )
    expect(html).toContain('fill="var(--compare-a)" fill-opacity="0.4"')
    expect(html).not.toContain("data-compare-shot")
  })

  it("sonst jeder Schuss als Punkt, B zuerst, dann A", () => {
    const html = render(ring(12), ring(8))
    expect(html).toContain('data-compare-picture="dots"')
    expect(html.match(/data-compare-shot="a"/g)).toHaveLength(12)
    expect(html.match(/data-compare-shot="b"/g)).toHaveLength(8)
    expect(html.lastIndexOf('data-compare-shot="b"')).toBeLessThan(
      html.indexOf('data-compare-shot="a"')
    )
  })

  it("Ringe und Ringzahlen über den Seiten, die Mitten darüber mit A und B", () => {
    const html = render(ring(12), ring(8))
    const lastShot = html.lastIndexOf("data-compare-shot")
    expect(html.indexOf("data-ring=")).toBeGreaterThan(lastShot)
    expect(html.indexOf('data-compare-center="b"')).toBeGreaterThan(html.lastIndexOf("data-ring="))
    expect(html).toMatch(/>A<\/text>/)
    expect(html).toMatch(/>B<\/text>/)
    expect(html).toContain('aria-label="Bild beider Seiten: Satz"')
  })

  it("ohne Punkte auf einer Seite keine Mitte für sie", () => {
    const html = render([], ring(8))
    expect(html).not.toContain('data-compare-center="a"')
    expect(html).toContain('data-compare-center="b"')
  })
})
