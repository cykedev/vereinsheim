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
  it("ein Treffer je Schuss mit Lage, gefüllt in Ringwert-Farbe (U4: keine Probe als Ring)", () => {
    const html = render()
    expect([...html.matchAll(/<circle cx=/g)]).toHaveLength(3)
    expect(html).toMatch(/<circle cx="0" cy="0"[^>]*fill="var\(--score-10\)"/)
    expect(html).toMatch(/<circle cx="0.8" cy="0"[^>]*fill="var\(--score-9\)"/)
    expect(html).toMatch(/<circle cx="1.5" cy="0"[^>]*fill="var\(--score-9\)"/)
  })

  it("nur Bild: aria-hidden, Ecke der Probe und blass nur auf Wunsch", () => {
    expect(render()).toMatch(/^<svg[^>]*aria-hidden="true"/)
    expect(render()).not.toContain("data-probe-corner")
    expect(render({ probeCorner: true })).toContain('data-probe-corner="true"')
    expect(render()).not.toContain("opacity-55")
    expect(render({ dim: true })).toContain("opacity-55")
  })
})
