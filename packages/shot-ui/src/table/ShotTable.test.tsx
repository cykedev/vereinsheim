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

// wie am Ausdruck, ohne Probe (U4); Serie 1: 1–3, Serie 2: 4–5. Nach Schuss 2 fehlt seq 5 (Lücke), vor Schuss 4
// vier Minuten Pause, Schuss 5 ohne Lage
const CARD = [
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
    expect(shotIntervals(CARD)).toEqual([null, 45_000, null, 240_000, 52_000])
  })

  it("mit der rohen Karte als Kontext reißt eine Probe zwischen Wertung keine Lücke (SF-04, Review U4)", () => {
    // Probe als seq 5 zwischen Schuss 2 (seq 4) und Schuss 3 (seq 6): auf der gedruckten Karte fehlt sie
    const raw = [...CARD.slice(0, 2), shot(5, "probe", null, 0, 100, 170), ...CARD.slice(2)]
    expect(shotIntervals(CARD)[2]).toBeNull()
    expect(shotIntervals(CARD, raw)[2]).toBe(55_000)
  })

  it("in Abgabefolge, auch wenn die Liste anders steht", () => {
    expect(shotIntervals([...CARD].reverse())).toEqual(shotIntervals(CARD).reverse())
  })
})

describe("ShotTable", () => {
  it("neuester Schuss oben, keine „P“-Nummern (U4)", () => {
    expect(rows(render()).map((r) => r[0])).toEqual(["5", "4", "3", "2", "1"])
  })

  it("folgt der Auswahl: nur die Zeilen der gewählten Serie", () => {
    expect(rows(render({ selection: 2 })).map((r) => r[0])).toEqual(["5", "4"])
  })

  it("Trenner zwischen den Serien, neueste zuerst; bei einer Serie keiner", () => {
    const groups = (html: string) =>
      [...html.matchAll(/<th[^>]*scope="rowgroup"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1])
    expect(groups(render())).toEqual(["Serie 2", "Serie 1"])
    // jede Gruppe ein eigener tbody mit ihren Zeilen
    expect([...render().matchAll(/<tbody>/g)]).toHaveLength(2)
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
    const measured = { ...CARD[0], distanceUm: 3317, xUm: 0, yUm: 3318 }
    const pdfOnly = { ...CARD[1], xUm: null, yUm: null, distanceUm: 5000 }
    const placeholder = { ...CARD[2], xUm: 0, yUm: 0, flags: ["verdaechtig"] }
    const html = renderToStaticMarkup(
      createElement(ShotTable, {
        shots: [measured, pdfOnly, placeholder],
        state: initialViewState(),
      })
    )
    const teiler = Object.fromEntries(rows(html).map((r) => [r[0], r[3]]))
    expect(teiler["1"]).toBe("331,7")
    expect(teiler["2"]).toBe("500,0")
    expect(teiler["3"]).toBe("–")
  })

  it("Intervalle in Sekunden, eine Pause in Minuten und Sekunden mit „Pause“, nach einer Lücke keins", () => {
    const r = rows(render())
    // „3:20 min“ statt auf ganze Minuten gerundet (Prüfung, Zeit 7)
    expect(r.map((row) => row[4])).toEqual(["52 s", "4:00 min Pause", "–", "45 s", "–"])
  })

  it("Pause relativ zum Takt der Karte: 120 s bei 40 s Takt ja, bei 60 s Takt nicht (User, 10. Oktober 2026)", () => {
    const paced = (gaps: number[]) =>
      gaps
        .reduce<number[]>((times, gap) => [...times, times.at(-1)! + gap], [0])
        .map((at, i) => shot(i + 1, "match", 1, 0, 100, at))
    const table = (gaps: number[]) =>
      rows(
        renderToStaticMarkup(
          createElement(ShotTable, { shots: paced(gaps), state: initialViewState() })
        )
      ).map((r) => r[4])
    // neueste Zeile oben: der Abstand vor Schuss 6 steht in der zweiten Zeile
    expect(table([40, 40, 40, 40, 120, 40])[1]).toBe("2:00 min Pause")
    expect(table([60, 60, 60, 60, 120, 60])[1]).toBe("120 s")
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
    expect(rows(html).map((r) => r[4])).toEqual(["3:00 min Pause", "180 s", "–"])
    const longer = renderToStaticMarkup(
      createElement(ShotTable, {
        shots: [shot(1, "match", 1, 0, 100, 0), shot(2, "match", 1, 0, 100, 200)],
        state: initialViewState(),
      })
    )
    expect(rows(longer).map((r) => r[4])).toEqual(["3:20 min Pause", "–"])
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
    const html = render({ chosen: { index: 1, series: 1 } })
    expect([...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>/g)]).toHaveLength(1)
    expect(html).toMatch(/<tr data-row="2"[^>]*data-chosen="true"[\s\S]*?aria-pressed="true"/)
    expect([...html.matchAll(/<button[^>]*aria-pressed="false"/g)]).toHaveLength(4)
    expect(html).toContain('aria-label="Schuss 2 wählen"')
    expect(html).not.toContain("Probe")
  })

  it("Farbpunkt in der Ringwert-Farbe, keiner hohl", () => {
    const html = render()
    expect(html).toMatch(/<tr data-row="1"[\s\S]*?background:var\(--score-10\)/)
    expect(html).not.toContain("box-shadow")
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

  it("der Knopf verweist auf die Tabelle", () => {
    const html = table()
    const controls = html.match(/<button[^>]*aria-controls="([^"]+)"[^>]*>Alle 15 zeigen/)![1]
    expect(html).toContain(`<table id="${controls}"`)
  })

  it("der Kopf einer ganz zugeklappten Serie ist mit versteckt, außer der gewählte Schuss liegt darin", () => {
    // Serie 1 mit sechs, Serie 2 mit zwölf Schüssen: die zehn neuesten sind alle aus Serie 2
    const two: MetricShot[] = [
      ...many.slice(0, 6).map((s) => ({ ...s, series: 1 })),
      ...Array.from({ length: 12 }, (_, i) => ({
        ...many[0],
        xUm: i * 50,
        firedAtMs: (10 + i) * 60_000,
        series: 2,
      })),
    ]
    const header = (html: string, name: string) =>
      html.match(new RegExp(`<tr( class="[^"]*")?><th scope="rowgroup"[^>]*>${name}</th>`))![1] ??
      ""
    expect(header(table({}, two), "Serie 1")).toContain("max-md:hidden")
    expect(header(table({}, two), "Serie 2")).not.toContain("max-md:hidden")
    expect(header(table({ chosen: { index: 0, series: 1 } }, two), "Serie 1")).not.toContain(
      "max-md:hidden"
    )
  })

  it("bei zehn oder weniger Zeilen kein Knopf und nichts versteckt", () => {
    const html = table({}, many.slice(0, 10))
    expect(hiddenRows(html)).toEqual([])
    expect(html).not.toContain("aria-expanded")
  })
})
