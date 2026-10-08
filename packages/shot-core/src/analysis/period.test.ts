import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import { metricByKey } from "../metrics"
import { cardValues, periodTrend, type CardValue } from "./period"

const values = (list: readonly number[]): CardValue[] =>
  list.map((value, i) => ({ id: `s${i + 1}`, atMs: i * DAY, value, n: 40 }))

describe("Werte je Scheibe (T1)", () => {
  const mean = metricByKey("result.decimalMean")!

  it("Ø je Schuss je Scheibe, nach Beginn geordnet, auch bei vertauschter Eingabe", () => {
    const cards = [card("c", 3, [95]), card("a", 1, [100, 100]), card("b", 2, [90, 92])]
    expect(cardValues(cards, mean, "decimal").map((v) => [v.id, v.value, v.n])).toEqual([
      ["a", 10, 2],
      ["b", 9.1, 2],
      ["c", 9.5, 1],
    ])
  })

  it("bei gleichem Beginn nach Kennung", () => {
    const cards = [card("b", 1, [90]), card("a", 1, [100])]
    expect(cardValues(cards, mean, "decimal").map((v) => v.id)).toEqual(["a", "b"])
  })

  it("in ganzen Ringen die ganzen Ringe", () => {
    const cards = [card("a", 1, [100, 100]), card("b", 2, [90, 92]), card("c", 3, [95])]
    expect(cardValues(cards, mean, "rings").map((v) => v.value)).toEqual([10, 9, 9])
  })

  it("eine Scheibe nur mit Probe nur mit includeProbeOnly, dann über die Probe (SF-01, D8)", () => {
    const cards = [card("a", 1, [100]), card("p", 2, [98, 96], { probe: true })]
    expect(cardValues(cards, mean, "decimal").map((v) => v.id)).toEqual(["a"])
    const withProbe = cardValues(cards, mean, "decimal", { includeProbeOnly: true })
    expect(withProbe.map((v) => [v.id, v.value])).toEqual([
      ["a", 10],
      ["p", 9.7],
    ])
  })

  it("ohne Wert fällt die Scheibe weg", () => {
    const blind = card("x", 1, [100])
    const cards = [
      { ...blind, shots: blind.shots.map((s) => ({ ...s, decimalTenths: null, ring: null })) },
    ]
    expect(cardValues(cards, mean, "decimal")).toEqual([])
  })
})

describe("Verlauf mit gleitendem Schnitt und Formband (T1, T2)", () => {
  const twelve = values([9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10])

  it("Schnitt der letzten fünf, vorher „bisher“", () => {
    const { points } = periodTrend(twelve)
    expect(points[2]).toMatchObject({ mean: 9, partial: true, band: null })
    expect(points[4].mean).toBeCloseTo(9.2, 12)
    expect(points[4].partial).toBe(false)
    expect(points[5].mean).toBeCloseTo(9.6, 12)
  })

  it("Formband: Schnitt ± 1,4826 · MAD der Abweichungen der vollen Fenster", () => {
    // volle Schnitte 9,2 / 9,6 / 9,4 / 9,8 / 9,4 / 9,6 / 9,2 / 9,4; Abweichungen −0,2 / 1,4 / −0,4 / 0,2 /
    // −1,4 / 0,4 / −0,2 / 0,6, Median 0, MAD 0,4 → Schwankung 0,59304
    const { points, spread } = periodTrend(twelve)
    expect(spread).not.toBeNull()
    expect(spread).toBeCloseTo(0.59304, 9)
    expect(points[11].band?.low).toBeCloseTo(9.4 - 0.59304, 9)
    expect(points[11].band?.high).toBeCloseTo(9.4 + 0.59304, 9)
    expect(points[3].band).toBeNull()
  })

  it("unter zehn Scheiben kein Band", () => {
    const { points, spread } = periodTrend(values([9, 10, 8, 10, 9, 11, 9, 10, 8]))
    expect(spread).toBeNull()
    expect(points.every((p) => p.band === null)).toBe(true)
  })
})
