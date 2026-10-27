import { FLAG_OVER_TARGET, FLAG_SUSPICIOUS, type MetricShot } from "@vereinsheim/shot-core/metrics"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { asOnPrintout, formatTotal } from "../shots"
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

// drei Probeschüsse, Serie 1 voll mit zehnmal 10,5, Serie 2 läuft mit siebenmal 10,0; die Seite gibt die Karte
// wie am Ausdruck weiter: ohne die Probe
const RAW = [
  ...[0, 1, 2].map((i) => shot("probe", null, 5000 + i * 1000, 95)),
  ...Array.from({ length: 10 }, (_, i) => shot("match", 1, i * 300, 105)),
  ...Array.from({ length: 7 }, (_, i) => shot("match", 2, -i * 300, 100)),
]
const CARD = asOnPrintout(RAW)

const render = (state: Partial<ViewState> = {}) =>
  renderToStaticMarkup(
    createElement(SeriesStrip, {
      target: LP_10M,
      shots: CARD,
      state: { ...initialViewState(), ...state },
      onSelect: () => {},
      onSelectWhole: () => {},
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
  it("die Serien mit Ergebnis, keine Probe-Kachel; die laufende Serie mit Zahl der Schüsse", () => {
    const html = render()
    const titles = [...html.matchAll(/<span data-title="true"[^>]*>([^<]+)<\/span>/g)].map(
      (m) => m[1]
    )
    expect(titles).toEqual(["Serie 1", "Serie 2"])
    expect(html).toMatch(/Serie 1[\s\S]*?105,0/)
    expect(html).toMatch(/Serie 2[\s\S]*?70,0[\s\S]*?7 von 10 Schuss/)
  })

  it("in ganzen Ringen ganze Zahlen", () => {
    const html = render({ scoring: "rings" })
    expect(html).toMatch(/Serie 1[\s\S]*?>100</)
    expect(html).toMatch(/Serie 2[\s\S]*?>70</)
  })

  it("ohne verdächtigen Platzhalter; ein Schuss über der Soll-Zahl bleibt (SF-15, SF-08)", () => {
    const html = renderToStaticMarkup(
      createElement(SeriesStrip, {
        target: LP_10M,
        shots: [
          shot("match", 1, 1000, 105),
          { ...shot("match", 1, 0, 95), flags: [FLAG_SUSPICIOUS] },
          { ...shot("match", 1, 2000, 0), flags: [FLAG_OVER_TARGET] },
        ],
        state: initialViewState(),
      })
    )
    // jeder Treffer trägt den Rand `--shot-edge` (MiniTarget), Ringe nicht
    expect(html.match(/stroke="var\(--shot-edge\)"/g)).toHaveLength(2)
  })

  it("alle kleinen Scheiben im selben Ausschnitt um die Mitte", () => {
    const boxes = [...render().matchAll(/<svg[^>]*viewBox="([^"]+)"/g)].map((m) => m[1])
    expect(boxes).toHaveLength(2)
    expect(new Set(boxes).size).toBe(1)
  })

  it("Kacheln sind Schalter: bei „alle“ ist nur „Alle“ gedrückt", () => {
    const html = render()
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Alle<\/button>/)
    expect([
      ...html.matchAll(/<button[^>]*data-series="[^"]+"[^>]*aria-pressed="false"/g),
    ]).toHaveLength(2)
  })

  it("bei einer gewählten Serie ist nur ihre Kachel gedrückt, die übrigen blass", () => {
    const html = render({ selection: 2 })
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Alle<\/button>/)
    expect(html).toMatch(/data-series="2"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/data-series="1"[^>]*aria-pressed="false"[^>]*data-dim="true"/)
  })

  it("wie am Ausdruck: keine Probe-Kachel, kein „Ohne Probe“, kein Probe-Eck an den Serien", () => {
    const html = render()
    expect(html).not.toContain('data-series="probe"')
    expect(html).not.toContain("Ohne Probe")
    expect(html).not.toContain("data-probe-corner")
  })

  it("Trainingskarte (nur Probe, wie Wertung): jede Serie trägt das Probe-Eck", () => {
    const probes = Array.from({ length: 23 }, (_, i) => ({
      ...shot("probe", null, i * 100, 100),
      seq: i + 1,
    }))
    const html = renderToStaticMarkup(
      createElement(SeriesStrip, {
        target: LP_10M,
        shots: asOnPrintout(probes),
        state: initialViewState(),
      })
    )
    const tiles = [...html.matchAll(/<button[^>]*data-series="(\d+)"[\s\S]*?<\/button>/g)]
    expect(tiles.map((m) => m[1])).toEqual(["1", "2", "3"])
    expect(tiles.every((m) => m[0].includes("data-probe-corner"))).toBe(true)
  })

  it("jede Kachel hat einen Satz für Screenreader, das Bild darin schweigt", () => {
    const html = render()
    expect(html).toMatch(
      /<button[^>]*aria-label="Serie 1: 105,0"[^>]*>\s*<svg[^>]*aria-hidden="true"/
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

describe("Serien aus Schüssen ohne Lage", () => {
  it("je Serie der leise Platzhalter, wie bei Serien aus Summen; Serien mit Lage zeichnen ihre Treffer", () => {
    const blind = CARD.map((s) => (s.series === 2 ? { ...s, xUm: null, yUm: null } : s))
    const html = renderToStaticMarkup(
      createElement(SeriesStrip, { target: LP_10M, shots: blind, state: initialViewState() })
    )
    const tile = (n: number) => {
      const start = html.indexOf(`data-series="${n}"`)
      return html.slice(start, html.indexOf("</button>", start))
    }
    expect(tile(2)).toContain('data-mini-placeholder="true"')
    expect(tile(2)).not.toContain("<circle cx=")
    expect(tile(1)).not.toContain("data-mini-placeholder")
    expect(tile(1)).toContain("<circle cx=")
  })
})

describe("ein Bau für jede Detailtiefe", () => {
  const SUMS = [
    { series: 1, shots: 10, rings: 90, decimalTenths: 950 },
    { series: 2, shots: 10, rings: 88, decimalTenths: null },
  ]
  const strip = (props: Partial<Parameters<typeof SeriesStrip>[0]>) =>
    renderToStaticMarkup(
      createElement(SeriesStrip, { target: LP_10M, shots: [], state: initialViewState(), ...props })
    )

  it("Serien-Summen: dieselbe Leiste und dieselben Kacheln, die kleine Scheibe als Platzhalter, ohne Wahl", () => {
    const html = strip({ sums: SUMS, state: initialViewState({ scoring: "decimal" }) })
    expect(html).toMatch(/^<div data-sum-series="true" class="grid gap-2\.5">/)
    expect(html).toContain(">Serien<")
    expect(html).toContain(">Alle<")
    expect(html).not.toContain("<button")
    expect(html.match(/data-series="/g)).toHaveLength(2)
    expect(html.match(/data-mini-placeholder="true"/g)).toHaveLength(2)
    expect(html).not.toContain("data-summary-center")
    expect(html).toContain(">95,0<")
    expect(html).toContain('<span title="ohne Zehntel">–')
    // die Schusszahl immer, wie „n von 10 Schuss“ bei Schüssen
    expect(html.match(/>10 Schuss</g)).toHaveLength(2)
  })

  it("Schüsse mit Serien gehen vor Summen; ganz ohne Serien der Satz unter derselben Leiste", () => {
    expect(strip({ shots: CARD, sums: SUMS })).not.toContain("data-sum-series")
    const none = strip({ missing: "Nur das Gesamtergebnis, keine Serien." })
    expect(none).toContain(">Serien<")
    expect(none).toMatch(
      /<p data-series-missing="true"[^>]*>Nur das Gesamtergebnis, keine Serien\.<\/p>/
    )
    expect(none).not.toContain(">Alle<")
    expect(strip({})).toBe("")
  })
})
