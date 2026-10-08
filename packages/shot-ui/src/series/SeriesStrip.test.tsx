import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatTotal } from "../shots"
import { initialViewState, type ViewState } from "../view-state"
import { SeriesStrip } from "./SeriesStrip"

const shot = (
  kind: "probe" | "match",
  series: number | null,
  xUm: number,
  tenths: number
): MetricShot => ({
  xUm,
  yUm: 0,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind,
  series,
})

// drei Probeschüsse, Serie 1 voll mit zehnmal 10,5, Serie 2 läuft mit siebenmal 10,0
const CARD = [
  ...[0, 1, 2].map((i) => shot("probe", null, 5000 + i * 1000, 95)),
  ...Array.from({ length: 10 }, (_, i) => shot("match", 1, i * 300, 105)),
  ...Array.from({ length: 7 }, (_, i) => shot("match", 2, -i * 300, 100)),
]

const render = (state: Partial<ViewState> = {}) =>
  renderToStaticMarkup(
    createElement(SeriesStrip, {
      target: LP_10M,
      shots: CARD,
      state: { ...initialViewState(), ...state },
      onSelect: () => {},
      onSelectAll: () => {},
    })
  )

describe("Summen in der gewählten Wertung", () => {
  it("Zehntel mit Komma, ganze Ringe ohne", () => {
    expect(formatTotal(105, "decimal")).toBe("105,0")
    expect(formatTotal(100, "rings")).toBe("100")
    expect(formatTotal(null, "decimal")).toBe("–")
  })
})

describe("SeriesStrip", () => {
  it("Probe zuerst, dann die Serien mit Ergebnis; die laufende Serie mit Zahl der Schüsse", () => {
    const html = render()
    const titles = [...html.matchAll(/<span data-title="true"[^>]*>([^<]+)<\/span>/g)].map(
      (m) => m[1]
    )
    expect(titles).toEqual(["Probe", "Serie 1", "Serie 2"])
    expect(html).toMatch(/Serie 1[\s\S]*?105,0/)
    expect(html).toMatch(/Serie 2[\s\S]*?70,0[\s\S]*?7 von 10 Schuss/)
  })

  it("in ganzen Ringen ganze Zahlen", () => {
    const html = render({ scoring: "rings" })
    expect(html).toMatch(/Serie 1[\s\S]*?>100</)
    expect(html).toMatch(/Serie 2[\s\S]*?>70</)
  })

  it("alle kleinen Scheiben im selben Ausschnitt um die Mitte", () => {
    const boxes = [...render().matchAll(/<svg[^>]*viewBox="([^"]+)"/g)].map((m) => m[1])
    expect(boxes).toHaveLength(3)
    expect(new Set(boxes).size).toBe(1)
  })

  it("Kacheln sind Schalter: bei „alle“ ist nur „Alle“ gedrückt", () => {
    const html = render()
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Alle<\/button>/)
    expect([
      ...html.matchAll(/<button[^>]*data-series="[^"]+"[^>]*aria-pressed="false"/g),
    ]).toHaveLength(3)
  })

  it("bei einer gewählten Serie ist nur ihre Kachel gedrückt, die übrigen blass", () => {
    const html = render({ selection: 2 })
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Alle<\/button>/)
    expect(html).toMatch(/data-series="2"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/data-series="probe"[^>]*aria-pressed="false"[^>]*data-dim="true"/)
    expect(html).toMatch(/data-series="1"[^>]*aria-pressed="false"[^>]*data-dim="true"/)
  })

  it("die kleine Scheibe der Probe trägt das Probe-Eck, die Serien nicht", () => {
    const html = render()
    const probe = html.split('data-series="1"')[0]
    expect(probe).toContain("data-probe-corner")
    expect(html.slice(html.indexOf('data-series="1"'))).not.toContain("data-probe-corner")
  })

  it("Probe hohl und durchgezogen", () => {
    const probe = render().split('data-series="1"')[0]
    expect(probe).not.toContain("stroke-dasharray")
    expect([
      ...probe.matchAll(/<circle[^>]*fill="none"[^>]*stroke="var\(--score-9\)"/g),
    ]).toHaveLength(3)
  })

  it("jede Kachel hat einen Satz für Screenreader, das Bild darin schweigt", () => {
    const html = render()
    expect(html).toMatch(
      /<button[^>]*aria-label="Probe: 3 Schuss"[^>]*>\s*<svg[^>]*aria-hidden="true"/
    )
    expect(render()).toMatch(/<button[^>]*aria-label="Serie 2: 70,0, 7 von 10 Schuss"/)
    expect(html).not.toContain('role="img"')
  })

  it("blasse Kacheln: nur das Bild tritt zurück, die Schrift bleibt lesbar", () => {
    const html = render({ selection: 2 })
    const dim = html.slice(html.indexOf('data-series="1"'), html.indexOf('data-series="2"'))
    expect(dim).toMatch(/<svg[^>]*class="[^"]*opacity-55/)
    expect(html).not.toMatch(/<button[^>]*class="[^"]*opacity-55/)
  })

  it("ein Wertungsschuss ohne Wert hohl und gestrichelt wie auf der großen Scheibe", () => {
    const html = renderToStaticMarkup(
      createElement(SeriesStrip, {
        target: LP_10M,
        shots: [{ ...shot("match", 1, 0, 100), ring: null, decimalTenths: null }],
        state: initialViewState(),
      })
    )
    expect(html).toMatch(/<circle[^>]*fill="none"[^>]*stroke-dasharray="2 2"/)
  })
})
