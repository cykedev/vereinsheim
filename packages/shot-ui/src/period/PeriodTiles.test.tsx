import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { periodModel } from "./model"
import { PeriodInsights, recordRows } from "./PeriodInsights"
import { PeriodTiles } from "./PeriodTiles"
import { initialPeriodState, type PeriodState } from "./state"
import { NOW, periodCard, TZ } from "./testSeason"

const model = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
  periodModel({
    cards,
    state: { ...initialPeriodState({ family: "lg-10m" }), ...partial },
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })
const now = [60, 70, 80, 90, 100].map((t, i) => periodCard(`n${i}`, 10 + i, [t, t, t]))
const before = [10, 20, 30, 40, 50].map((t, i) => periodCard(`v${i}`, 100 + i, [t, t, t]))

describe("Zahlen über den Zeitraum (D11)", () => {
  it("sechs Kacheln mit Mittel je Scheibe und Zahl der Scheiben", () => {
    const m = model(now)
    const html = renderToStaticMarkup(h(PeriodTiles, { tiles: m.tiles, compareLabel: null }))
    expect([...html.matchAll(/data-period-tile="/g)]).toHaveLength(6)
    expect(html).toMatch(
      /data-period-tile="result.decimalMean"[\s\S]*?8,00<small[^>]*>Ringe[\s\S]*?5 Scheiben/
    )
    expect(html).not.toContain("data-tile-compare")
  })

  it("mit Vergleich: Wert dort, Δ und Urteil; ohne Wert ein Strich mit Grund", () => {
    const m = model([...now, ...before], { compare: { type: "previous" } })
    const html = renderToStaticMarkup(
      h(PeriodTiles, { tiles: m.tiles, compareLabel: "Zeitraum davor" })
    )
    expect(html).toMatch(
      /data-period-tile="result.decimalMean"[\s\S]*?Zeitraum davor: 3,00<br\/><span[^>]*>Δ \+5,00 · <\/span><span[^>]*>höher, besser · bedeutsam/
    )
    // drei Schüsse ohne Zeit zwischen ihnen gibt es nicht: das Tempo hat Werte; ohne Scheiben ein Strich
    const empty = renderToStaticMarkup(
      h(PeriodTiles, { tiles: model([]).tiles, compareLabel: null })
    )
    expect(empty).toContain("keine Scheibe mit Wert")
  })
})

describe("Analyse über den Zeitraum (D12)", () => {
  const render = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
    renderToStaticMarkup(
      h(PeriodInsights, {
        model: model(cards, partial),
        scoring: "decimal",
        timeZone: TZ,
        explain: false,
        onHelp: () => {},
        onChoose: () => {},
      })
    )

  it("gegen deinen Schnitt: neueste Scheibe, Schnitt der 30 Tage davor, Platz unter den letzten n", () => {
    // n0 (6,0, vor 10 Tagen) gegen n1 … n4 (7,0 … 10,0): Schnitt 8,5, Abstand −2,5; fünf Scheiben, kein Platz
    const html = render(now)
    expect(html).toContain('data-help="gegen-den-schnitt"')
    expect(html).toMatch(/Neueste Scheibe[\s\S]*?6,00 am 20\.09\.2026/)
    expect(html).toMatch(/Schnitt der 30 Tage davor[\s\S]*?8,50 \(4 Scheiben\)/)
    expect(html).toMatch(/Abstand[\s\S]*?−2,50/)
    expect(html).toMatch(/Platz unter deinen letzten 50[\s\S]*?ab 10 Scheiben/)
  })

  it("Rekorde in der Reihenfolge des Katalogs, außerhalb des Zeitraums nicht wählbar", () => {
    const old = periodCard("alt", 200, [109, 109, 109])
    const m = model([...now, old])
    const rows = recordRows(m.records, "decimal")
    expect(rows[0]).toMatchObject({ key: "R1:3", label: "Ergebnis, 3 Schuss", value: "32,7 Ringe" })
    expect(rows.map((r) => r.key)).toContain("R3")
    const html = render([...now, old])
    expect(html).toMatch(
      /data-record="R1:3"[\s\S]*?disabled=""[^>]*title="außerhalb des Zeitraums"/
    )
    expect(html).toMatch(/data-record="R8"[\s\S]*?zeigen<\/button>/)
    expect(html).toMatch(
      /aria-label="Ergebnis, 3 Schuss vom \d\d\.\d\d\.\d{4}: außerhalb des Zeitraums"/
    )
    expect(html).toMatch(/aria-label="beste Form \(Ø über fünf Scheiben\) vom [\d.]+ zeigen"/)
  })

  it("ohne Scheiben: Hinweise statt leerer Karten", () => {
    const html = render([])
    expect(html).toContain("Keine Scheibe im Zeitraum.")
    expect(html).toContain("Noch kein Rekord")
  })
})
