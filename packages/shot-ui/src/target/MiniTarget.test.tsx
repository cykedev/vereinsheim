import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { LG_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { seriesTileView } from "../geometry"
import { MiniTarget } from "./MiniTarget"

const shot = (kind: "probe" | "match", xUm: number | null, tenths: number | null): MetricShot => ({
  xUm,
  yUm: xUm === null ? null : 0,
  decimalTenths: tenths,
  ring: tenths === null ? null : Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind,
  series: kind === "match" ? 1 : null,
})

const SHOTS = [
  shot("match", 0, 105),
  shot("match", 800, 98),
  shot("match", null, 90),
  shot("match", 1500, 95),
]
const render = (props: Partial<Parameters<typeof MiniTarget>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(MiniTarget, {
      target: LG_10M,
      view: seriesTileView(LG_10M, [{ xUm: 0, yUm: 0 }]),
      shots: SHOTS,
      ...props,
    })
  )

describe("MiniTarget", () => {
  it("ein Treffer je Schuss mit Lage, gefüllt in Ringwert-Farbe (keine Probe als Ring)", () => {
    const html = render()
    expect([...html.matchAll(/<circle cx=/g)]).toHaveLength(3)
    expect(html).toMatch(/<circle cx="0" cy="0"[^>]*fill="var\(--score-10\)"/)
    expect(html).toMatch(/<circle cx="0.8" cy="0"[^>]*fill="var\(--score-9\)"/)
    expect(html).toMatch(/<circle cx="1.5" cy="0"[^>]*fill="var\(--score-9\)"/)
  })

  it("ohne Ausschnitt um die Mitte, der Spiegel gleich groß (miniView über die Treffer mit Lage)", () => {
    // LG, Treffer bei 0, 0,8 und 1,5 mm: innerhalb, also 15,25 · 1,6 = 24,4
    const html = renderToStaticMarkup(createElement(MiniTarget, { target: LG_10M, shots: SHOTS }))
    expect(html).toContain('viewBox="-24.4 -24.4 48.8 48.8"')
    // ein Treffer bei 20 mm vergrößert ihn: (20 + 2,25) · 1,12 = 24,92
    const wide = renderToStaticMarkup(
      createElement(MiniTarget, { target: LG_10M, shots: [...SHOTS, shot("match", 20000, 30)] })
    )
    expect(wide).toContain('viewBox="-24.92 -24.92 49.84 49.84"')
  })

  it("nur Bild: aria-hidden, Ecke der Probe und blass nur auf Wunsch", () => {
    expect(render()).toMatch(/^<svg[^>]*aria-hidden="true"/)
    expect(render()).not.toContain("data-probe-corner")
    expect(render({ probeCorner: true })).toContain('data-probe-corner="true"')
    expect(render()).not.toContain("opacity-55")
    expect(render({ dim: true })).toContain("opacity-55")
  })
})

describe("Ausschnitt auf 1 µm", () => {
  it("Server und Browser zeichnen denselben Ausschnitt, auch wenn er in der letzten Stelle abweicht", () => {
    const html = (x: number, y: number, w: number) =>
      renderToStaticMarkup(
        createElement(MiniTarget, { target: LG_10M, view: { x, y, w }, shots: [] })
      )
    const server = html(-40.616908819539134, -53.32336744961411, 109.34488645316945)
    const browser = html(-40.61690881953914, -53.32336744961412, 109.34488645316947)
    expect(server).toBe(browser)
    expect(server).toContain('viewBox="-40.617 -53.323 109.345 109.345"')
  })
})

describe("Platzhalter einer Scheibe ohne Lagen je Schuss", () => {
  it("die Scheibe leise, ohne Treffer, gleich groß wie eine echte kleine Scheibe", () => {
    const real = render({ className: "size-12" })
    const empty = render({ shots: [], placeholder: true, className: "size-12" })
    expect(empty).toMatch(/^<svg viewBox="[^"]*" aria-hidden="true" data-mini-placeholder="true"/)
    expect(empty).not.toContain("<circle cx=")
    expect(empty).toContain('<g opacity="0.35">')
    // gleiche Klassen (Größe) und derselbe Ausschnitt wie eine Scheibe mit Treffern um die Mitte
    const classes = (html: string) => /class="([^"]*)"/.exec(html)?.[1]
    expect(classes(empty)).toBe(classes(real))
    expect(/viewBox="([^"]*)"/.exec(empty)?.[1]).toBe(
      /viewBox="([^"]*)"/.exec(render({ shots: [shot("match", 0, 105)] }))?.[1]
    )
    expect(real).not.toContain("data-mini-placeholder")
  })

  it("ohne Mitte: auch der Platzhalter zeigt keinen Schwerpunkt, wie die kleinen Scheiben gemessener Scheiben", () => {
    const html = render({ shots: [], placeholder: true })
    expect(html).not.toContain("data-summary-center")
    expect(html).not.toContain("<title>Schwerpunkt")
  })
})
