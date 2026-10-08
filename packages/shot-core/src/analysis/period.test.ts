import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import { metricByKey } from "../metrics"
import {
  againstOwnAverage,
  cardValues,
  comparePeriods,
  periodBuckets,
  periodTrend,
  trainingVolume,
  type CardValue,
} from "./period"

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

describe("Boden und Decke je Abschnitt, Trainingsumfang (T5, T6)", () => {
  const week = (ms: number) => String(Math.floor(ms / (7 * DAY)))
  const at = (day: number, value: number, id = `d${day}`): CardValue => ({
    id,
    atMs: day * DAY,
    value,
    n: 40,
  })

  it("Median, P10 und P90 je Woche, Wochen in der Folge ihres ersten Werts", () => {
    // Typ 7: P10 bei h = 5 · 0,1 = 0,5 → 1 + 0,5 · (2 − 1) = 1,5; P90 bei h = 4,5 → 5,5
    const values = [8, 9, 10]
      .map((v, i) => at(i, v))
      .concat([1, 2, 3, 4, 5, 6].map((v, i) => at(7 + i, v)))
    const buckets = periodBuckets(values, week)
    expect(buckets.map((b) => b.key)).toEqual(["0", "1"])
    expect(buckets[1]).toEqual({ key: "1", n: 6, median: 3.5, p10: 1.5, p90: 5.5 })
  })

  it("unter fünf Werten nur der Median", () => {
    const buckets = periodBuckets([at(0, 8), at(1, 9), at(2, 10)], week)
    expect(buckets).toEqual([{ key: "0", n: 3, median: 9, p10: null, p90: null }])
  })

  it("Umfang: Schüsse mit Probe, Scheiben und Tage je Woche", () => {
    const cards = [
      card("a", 1, [100, 100], { shot: (i) => (i === 0 ? { kind: "probe", series: null } : {}) }),
      card("b", 1, [90, 92, 95]),
      card("c", 3, [95]),
      card("d", 8, [95, 96]),
    ]
    const day = (ms: number) => String(Math.floor(ms / DAY))
    expect(trainingVolume(cards, week, day)).toEqual([
      { key: "0", shots: 6, cards: 3, days: 2 },
      { key: "1", shots: 2, cards: 1, days: 1 },
    ])
  })
})

describe("Vergleich zweier Zeiträume (C3, T3)", () => {
  it("getrennte Gruppen 5 gegen 5: höher, genau, p 2/252, bedeutsam", () => {
    const result = comparePeriods(values([1, 2, 3, 4, 5]), values([6, 7, 8, 9, 10]))
    expect(result?.a).toEqual({ n: 5, mean: 3 })
    expect(result?.b).toEqual({ n: 5, mean: 8 })
    expect(result?.delta).toBe(5)
    expect(result?.test?.exact).toBe(true)
    expect(result?.test?.p).toBeCloseTo(2 / 252, 12)
    expect(result?.verdict).toBe("higher")
    expect(result?.meaningful).toBe(true)
  })

  it("umgekehrt tiefer", () => {
    expect(comparePeriods(values([6, 7, 8, 9, 10]), values([1, 2, 3, 4, 5]))?.verdict).toBe("lower")
  })

  it("gleiche Werte: unklar, Δ 0, nicht bedeutsam", () => {
    const result = comparePeriods(values([9, 9, 9, 9, 9]), values([9, 9, 9, 9, 9]))
    expect(result?.delta).toBe(0)
    expect(result?.test?.p).toBe(1)
    expect(result?.verdict).toBe("unclear")
    expect(result?.meaningful).toBe(false)
  })

  it("vier Scheiben auf einer Seite: kein Test, kein Urteil", () => {
    const result = comparePeriods(values([1, 2, 3, 4]), values([6, 7, 8, 9, 10]))
    expect(result?.a.n).toBe(4)
    expect(result?.test).toBeNull()
    expect(result?.verdict).toBe("unclear")
    expect(result?.meaningful).toBeNull()
  })

  it("eine leere Seite: null", () => {
    expect(comparePeriods([], values([1, 2, 3, 4, 5]))).toBeNull()
  })

  it("kleiner, aber klarer Unterschied: höher und bedeutsam (s = 0,0059)", () => {
    const a = values(Array.from({ length: 20 }, (_, i) => 9.5 + 0.001 * i))
    const b = values(a.map((v) => v.value + 0.05))
    const result = comparePeriods(a, b)
    expect(result?.test?.exact).toBe(true)
    expect(result?.verdict).toBe("higher")
    expect(result?.meaningful).toBe(true)
  })

  it("große Streuung: Δ 0,1 bei s 1,58 ist nicht bedeutsam und unklar", () => {
    const a = [8, 9, 10, 11, 12]
    const result = comparePeriods(values(a), values(a.map((v) => v + 0.1)))
    expect(result?.delta).toBeCloseTo(0.1, 12)
    expect(result?.meaningful).toBe(false)
    expect(result?.verdict).toBe("unclear")
  })

  it("widersprechen Rangtest und Mittel, kein Urteil", () => {
    // neun Einsen und eine 100 gegen zehn Zweien: die Ränge sagen „b höher“ (U = 10 von 100), das Mittel
    // „b tiefer“ (10,9 gegen 2)
    const result = comparePeriods(
      values([1, 1, 1, 1, 1, 1, 1, 1, 1, 100]),
      values(Array(10).fill(2))
    )
    expect(result?.test?.p).toBeLessThan(0.05)
    expect(result?.delta).toBeLessThan(0)
    expect(result?.verdict).toBe("unclear")
  })
})

describe("Gegen den eigenen Schnitt (C4)", () => {
  const at = (day: number, value: number): CardValue => ({
    id: `d${day}`,
    atMs: day * DAY,
    value,
    n: 40,
  })

  it("nur die 30 Tage davor zählen, unter drei kein Schnitt", () => {
    const result = againstOwnAverage([at(5, 9), at(15, 9), at(39, 11), at(40, 10.5)])
    expect(result?.last.id).toBe("d40")
    expect(result?.average).toBeNull()
  })

  it("ab drei Scheiben der Schnitt und der Abstand", () => {
    const result = againstOwnAverage([at(5, 1), at(15, 9), at(20, 10), at(39, 11), at(40, 10.5)])
    expect(result?.average).toEqual({ n: 3, mean: 10, delta: 0.5 })
  })

  it("genau 30 Tage davor zählt noch", () => {
    const result = againstOwnAverage([at(10, 9), at(15, 9), at(39, 12), at(40, 10)])
    expect(result?.average).toEqual({ n: 3, mean: 10, delta: 0 })
  })

  it("Perzentil: kleinere ganz, gleiche zur Hälfte (mit ihr), ab zehn", () => {
    // die zwölf Werte aus dem Verlauf, die letzte ist 10: sechs kleiner, fünf gleich → (6 + 2,5) / 12
    const twelve = values([9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10])
    expect(againstOwnAverage(twelve)?.percentile).toBeCloseTo(8.5 / 12, 12)
    expect(againstOwnAverage(twelve.slice(0, 9))?.percentile).toBeNull()
  })

  it("Perzentil nur über die letzten 50", () => {
    const list = values([...Array(10).fill(100), ...Array(50).fill(5)])
    expect(againstOwnAverage(list)?.percentile).toBe(0.5)
  })

  it("ohne Werte null", () => {
    expect(againstOwnAverage([])).toBeNull()
  })
})
