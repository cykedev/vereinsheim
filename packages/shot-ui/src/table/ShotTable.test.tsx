import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatValue } from "../format"
import { shotIntervals } from "../shots"
import { initialViewState, type ViewState } from "../view-state"
import { ShotTable } from "./ShotTable"

const T0 = Date.UTC(2026, 9, 2, 17, 0)

const shot = (
  seq: number,
  kind: "probe" | "match",
  series: number | null,
  xUm: number | null,
  tenths: number,
  atS: number | null,
  innerTen = false
): MetricShot => ({
  seq,
  xUm,
  yUm: xUm === null ? null : 0,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  innerTen,
  firedAtMs: atS === null ? null : T0 + atS * 1000,
  kind,
  series,
})

// Probe P1, P2; Serie 1: 1–3, Serie 2: 4–5. Nach Schuss 2 fehlt seq 6 (Lücke), vor Schuss 4 vier Minuten
// Pause, Schuss 5 ohne Lage
const CARD = [
  shot(1, "probe", null, 6000, 98, 0),
  shot(2, "probe", null, 1500, 104, 50),
  shot(3, "match", 1, 300, 108, 100, true),
  shot(4, "match", 1, 2000, 103, 145),
  shot(6, "match", 1, -1200, 105, 200),
  shot(7, "match", 2, 800, 107, 440),
  shot(8, "match", 2, null, 101, 492),
]

const render = (state: Partial<ViewState> = {}) =>
  renderToStaticMarkup(
    createElement(ShotTable, {
      shots: CARD,
      state: { ...initialViewState(), ...state },
      onChoose: () => {},
    })
  )

/** Zeilen als Text je Zelle */
const rows = (html: string) =>
  [...html.matchAll(/<tr data-row="[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
  )

describe("Intervalle aus dem Fachkern", () => {
  it("Abstand zum vorigen Schuss der Karte; der erste und nach einer Lücke keiner", () => {
    expect(shotIntervals(CARD)).toEqual([null, 50_000, 50_000, 45_000, null, 240_000, 52_000])
  })

  it("in Abgabefolge, auch wenn die Liste anders steht", () => {
    expect(shotIntervals([...CARD].reverse())).toEqual(shotIntervals(CARD).reverse())
  })
})

describe("ShotTable", () => {
  it("neuester Schuss oben, Probe mit P", () => {
    expect(rows(render()).map((r) => r[0])).toEqual(["5", "4", "3", "2", "1", "P2", "P1"])
  })

  it("folgt der Auswahl: nur die Zeilen der gewählten Serie oder der Probe", () => {
    expect(rows(render({ selection: 2 })).map((r) => r[0])).toEqual(["5", "4"])
    expect(rows(render({ selection: "probe" })).map((r) => r[0])).toEqual(["P2", "P1"])
  })

  it("Trenner zwischen den Serien, neueste zuerst; bei einer Serie keiner", () => {
    const groups = (html: string) =>
      [...html.matchAll(/<th[^>]*scope="rowgroup"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1])
    expect(groups(render())).toEqual(["Serie 2", "Serie 1", "Probe"])
    // jede Gruppe ein eigener tbody mit ihren Zeilen
    expect([...render().matchAll(/<tbody>/g)]).toHaveLength(3)
    expect(groups(render({ selection: 2 }))).toEqual([])
  })

  it("Farbpunkte stehen untereinander: der Wert hat eine feste Breite", () => {
    // „10,4“ und „9,0“ sind verschieden breit; rechtsbündig ohne feste Breite stünde der Punkt versetzt
    const html = render()
    const cells = [...html.matchAll(/<tr data-row="[^"]*"[\s\S]*?<\/tr>/g)].map((m) => m[0])
    expect(
      cells.every((row) =>
        /<span class="inline-block min-w-\[4ch\] text-right">[^<]+<\/span>/.test(row)
      )
    ).toBe(true)
  })

  it("Wert in der gewählten Wertung, Spaltenkopf Wert oder Ring", () => {
    expect(render()).toMatch(/<th[^>]*>Wert<\/th>/)
    expect(rows(render())[4][1]).toBe("10,8")
    expect(render({ scoring: "rings" })).toMatch(/<th[^>]*>Ring<\/th>/)
    expect(rows(render({ scoring: "rings" }))[4][1]).toBe("10")
  })

  it("Innenzehner markiert, Teiler aus der Lage, ohne Lage ein Strich", () => {
    const r = rows(render())
    expect(r[4][2]).toContain("★")
    expect(r[3][2]).toBe("")
    expect(r[4][3]).toBe(formatValue(distanceUm(300, 0) / 10, 1))
    expect(r[0][3]).toBe("–")
  })

  it("Teiler wie der Fachkern: gemessener Abstand vor der Lage, ohne Lage auch, verdächtig keiner", () => {
    const measured = { ...CARD[2], distanceUm: 3317, xUm: 0, yUm: 3318 }
    const pdfOnly = { ...CARD[3], xUm: null, yUm: null, distanceUm: 5000 }
    const placeholder = { ...CARD[4], xUm: 0, yUm: 0, flags: ["verdaechtig"] }
    const html = renderToStaticMarkup(
      createElement(ShotTable, {
        shots: [CARD[0], CARD[1], measured, pdfOnly, placeholder],
        state: initialViewState(),
      })
    )
    const teiler = Object.fromEntries(rows(html).map((r) => [r[0], r[3]]))
    expect(teiler["1"]).toBe("331,7")
    expect(teiler["2"]).toBe("500,0")
    expect(teiler["3"]).toBe("–")
  })

  it("Intervalle in Sekunden, über drei Minuten als Pause in Minuten, nach einer Lücke keins", () => {
    const r = rows(render())
    expect(r.map((row) => row[4])).toEqual(["52 s", "4 min", "–", "45 s", "50 s", "50 s", "–"])
  })

  it("Pause erst über drei Minuten: genau 180 s bleibt in Sekunden", () => {
    const html = renderToStaticMarkup(
      createElement(ShotTable, {
        shots: [
          shot(1, "match", 1, 0, 100, 0),
          shot(2, "match", 1, 0, 100, 180),
          shot(3, "match", 1, 0, 100, 360.001),
        ],
        state: initialViewState(),
      })
    )
    expect(rows(html).map((r) => r[4])).toEqual(["3 min", "180 s", "–"])
  })

  it("der Stern hat einen Text für Screenreader", () => {
    // in der Zeile des Innenzehners, nicht im Spaltenkopf
    const html = render()
    const row = html.slice(html.indexOf('<tr data-row="1"'))
    expect(row.slice(0, row.indexOf("</tr>"))).toMatch(
      /<span class="sr-only">Innenzehner<\/span><span aria-hidden="true">★<\/span>/
    )
  })

  it("jede Zeile ist ein Knopf; der angetippte Schuss ist gedrückt und hervorgehoben", () => {
    const html = render({ chosen: { index: 3, series: 1 } })
    expect([...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>/g)]).toHaveLength(1)
    expect(html).toMatch(/<tr data-row="2"[^>]*data-chosen="true"[\s\S]*?aria-pressed="true"/)
    expect([...html.matchAll(/<button[^>]*aria-pressed="false"/g)]).toHaveLength(6)
    expect(html).toContain('aria-label="Schuss 2 wählen"')
    expect(html).toContain('aria-label="Probe P1 wählen"')
  })

  it("Farbpunkt in der Ringwert-Farbe, Probe hohl", () => {
    const html = render()
    expect(html).toMatch(/<tr data-row="1"[\s\S]*?background:var\(--score-10\)/)
    expect(html).toMatch(/<tr data-row="P1"[\s\S]*?box-shadow:inset 0 0 0 1.5px var\(--score-9\)/)
  })
})

describe("Schusstabelle auf dem Telefon (Plan Schritt 4, D8)", () => {
  // 15 Wertungsschüsse in einer Serie
  const many: MetricShot[] = Array.from({ length: 15 }, (_, i) => ({
    xUm: i * 100,
    yUm: 0,
    decimalTenths: 100,
    ring: 10,
    innerTen: false,
    firedAtMs: i * 60_000,
    kind: "match",
    series: 1,
  }))
  const table = (state: Partial<ViewState> = {}, shots: readonly MetricShot[] = many) =>
    renderToStaticMarkup(
      createElement(ShotTable, { shots, state: { ...initialViewState(), ...state } })
    )
  const hiddenRows = (html: string) =>
    [...html.matchAll(/<tr data-row="(\d+)"[^>]*class="[^"]*max-md:hidden/g)].map((m) => m[1])

  it("die zehn neuesten Zeilen, die übrigen erst nach „Alle zeigen“", () => {
    const html = table()
    expect(hiddenRows(html)).toEqual(["5", "4", "3", "2", "1"])
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Alle 15 zeigen<\/button>/)
    expect(html).toMatch(/<button[^>]*class="[^"]*md:hidden[^"]*"[^>]*>Alle 15 zeigen/)
  })

  it("der gewählte Schuss bleibt sichtbar, auch wenn er älter ist", () => {
    expect(hiddenRows(table({ chosen: { index: 0, series: 1 } }))).toEqual(["5", "4", "3", "2"])
  })

  it("bei zehn oder weniger Zeilen kein Knopf und nichts versteckt", () => {
    const html = table({}, many.slice(0, 10))
    expect(hiddenRows(html)).toEqual([])
    expect(html).not.toContain("aria-expanded")
  })
})
