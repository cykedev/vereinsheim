import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import { metricByKey } from "../metrics"
import {
  againstOwnAverage,
  cardValues,
  comparePeriods,
  compareSamples,
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

  it("ein Mittel über Schüsse trägt die Streuung seiner Schusswerte (n − 1), unter zwei Schuss null", () => {
    const cards = [card("a", 1, [100, 102, 104]), card("b", 2, [95])]
    const [a, b] = cardValues(cards, mean, "decimal")
    // 10,0 · 10,2 · 10,4: Mittel 10,2, Σ(x − x̄)² = 0,08, s = √(0,08/2) = 0,2
    expect(a.sd).not.toBeNull()
    expect(a.sd).toBeCloseTo(0.2, 9)
    expect(b.sd).toBeNull()
    const tens = cardValues(cards, metricByKey("result.tensRate")!, "decimal")
    // Zehner 1, 1, 1: keine Streuung
    expect(tens[0].sd).toBe(0)
    expect("sd" in cardValues(cards, metricByKey("result.decimal")!, "decimal")[0]).toBe(false)
  })

  it("bei gleichem Beginn nach Kennung", () => {
    const cards = [card("b", 1, [90]), card("a", 1, [100])]
    expect(cardValues(cards, mean, "decimal").map((v) => v.id)).toEqual(["a", "b"])
  })

  it("in ganzen Ringen die ganzen Ringe", () => {
    const cards = [card("a", 1, [100, 100]), card("b", 2, [90, 92]), card("c", 3, [95])]
    expect(cardValues(cards, mean, "rings").map((v) => v.value)).toEqual([10, 9, 9])
  })

  it("eine Scheibe nur mit Probe nur mit includeProbeOnly, dann über die Probe (SF-01)", () => {
    const cards = [card("a", 1, [100]), card("p", 2, [98, 96], { probe: true })]
    expect(cardValues(cards, mean, "decimal").map((v) => v.id)).toEqual(["a"])
    const withProbe = cardValues(cards, mean, "decimal", { includeProbeOnly: true })
    expect(withProbe.map((v) => [v.id, v.value])).toEqual([
      ["a", 10],
      ["p", 9.7],
    ])
  })

  it("gleiche Werte bei verschiedener Schusszahl sind gleich (Ø je Schuss in zwei Schritten)", () => {
    // 3202 Zehntel auf 40 Schuss und 4803 auf 60 sind beide 8,005; ungerundet 8,004999… gegen 8,005
    const forty = card("a", 1, [...Array<number>(38).fill(80), 81, 81])
    const sixty = card("b", 2, [...Array<number>(57).fill(80), 81, 81, 81])
    const [a, b] = cardValues([forty, sixty], mean, "decimal")
    expect(a.value).toBe(8.005)
    expect(b.value).toBe(a.value)
  })

  it("Abstände über die ganze Karte: eine späte Probe ist keine Lücke (SF-04)", () => {
    // Wertung bei 0, 40, 100, 160 s, eine Probe bei 70 s (seq 3): Abstände 40, 60, 60, Median 60 s;
    // ohne die Karte fiele der Abstand über die Probe weg (Median 50 s)
    const seconds = [0, 40, 70, 100, 160]
    const late = card("p", 1, Array<number>(5).fill(100), {
      shot: (i) => ({
        firedAtMs: DAY + seconds[i] * 1000,
        ...(i === 2 ? { kind: "probe" as const, series: null } : {}),
      }),
    })
    const [value] = cardValues([late], metricByKey("time.intervalMedian")!, "decimal")
    expect(value.value).toBe(60)
    expect(value.n).toBe(4)
  })

  it("nur über die Wertungsschüsse, auch bei Maßen, die die Probe mitnehmen könnten", () => {
    // drei Probeschüsse weit außen vor zehn Wertungsschüssen auf einer Linie (0,9 mm)
    const mixed = card("m", 1, Array<number>(13).fill(100), {
      shot: (i) =>
        i < 3
          ? { kind: "probe", series: null, xUm: 5000 + 1000 * i }
          : { series: 1, xUm: 100 * (i - 3) },
    })
    const enclosing = metricByKey("group.enclosingDiameter")!
    const [value] = cardValues([mixed], enclosing, "decimal")
    expect(value.n).toBe(10)
    expect(value.value).toBeCloseTo(0.9, 9)
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

  it("mit einem Schnitt über die Schüsse zählt eine lange Scheibe mehr als eine kurze", () => {
    const weighted = [9, 10, 9, 10, 9].map((value, i) => ({
      id: `s${i + 1}`,
      atMs: i * DAY,
      value,
      n: value === 9 ? 10 : 40,
    }))
    const byShots = (window: readonly CardValue[]) =>
      window.reduce((s, v) => s + v.value * v.n, 0) / window.reduce((s, v) => s + v.n, 0)
    const { points } = periodTrend(weighted, byShots)
    // 3 × 90 + 2 × 400 = 1070 Ringe auf 110 Schuss, nicht 9,4 wie das Mittel der Werte
    expect(points[4].mean).toBeCloseTo(1070 / 110, 12)
    expect(periodTrend(weighted).points[4].mean).toBeCloseTo(9.4, 12)
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

  it("genau zehn Scheiben: Band, MAD um den Median der Abweichungen", () => {
    // volle Schnitte 9,2 / 9,6 / 9,6 / 10,2 / 10,0 / 10,4; Abweichungen −0,2 / 1,4 / 0,4 / 0,8 / −1,0 / 0,6,
    // Median 0,5, Abstände zu ihm 0,7 / 0,9 / 0,1 / 0,3 / 1,5 / 0,1, MAD 0,5 → Schwankung 0,7413
    // (um 0 statt um den Median wäre der MAD 0,7)
    const { points, spread } = periodTrend(values([9, 10, 8, 10, 9, 11, 10, 11, 9, 11]))
    expect(spread).not.toBeNull()
    expect(spread).toBeCloseTo(0.7413, 9)
    expect(points[9].band?.low).toBeCloseTo(10.4 - 0.7413, 9)
  })

  it("ohne Schwankung kein Band, auch nicht eines der Breite null", () => {
    // Innenzehner eines Anfängers: fast immer 0, einmal 1
    const { points, spread } = periodTrend(values([...Array(10).fill(0), 1, ...Array(5).fill(0)]))
    expect(spread).toBeNull()
    expect(points.every((p) => p.band === null)).toBe(true)
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

  it("Boden und Decke ab genau fünf Werten", () => {
    const five = [1, 2, 3, 4, 5].map((v, i) => at(i, v))
    expect(periodBuckets(five, week)[0].p10).not.toBeNull()
    expect(periodBuckets(five.slice(0, 4), week)[0].p10).toBeNull()
  })

  it("Umfang: Schüsse wie am Ausdruck, Scheiben und Tage je Woche; ein Training zählt seine Probe", () => {
    const cards = [
      // eine Probe vor der Wertung zeigt keine Seite mehr: Sie zählt nicht
      card("a", 1, [100, 100], { shot: (i) => (i === 0 ? { kind: "probe", series: null } : {}) }),
      card("b", 1, [90, 92, 95]),
      card("c", 3, [95]),
      // ein Training nur aus Probe zählt wie Wertung
      card("d", 8, [95, 96], { shot: () => ({ kind: "probe", series: null }) }),
    ]
    const day = (ms: number) => String(Math.floor(ms / DAY))
    expect(trainingVolume(cards, week, day)).toEqual([
      { key: "0", shots: 5, cards: 3, days: 2 },
      { key: "1", shots: 2, cards: 1, days: 1 },
    ])
  })
})

describe("Vergleich zweier Stichproben (C3, T3)", () => {
  it("Werte statt Scheiben: dieselbe Rechnung wie der Vergleich zweier Zeiträume", () => {
    const result = compareSamples([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])
    expect(result).toEqual(comparePeriods(values([1, 2, 3, 4, 5]), values([6, 7, 8, 9, 10])))
    expect(result?.verdict).toBe("higher")
    expect(result?.delta).toBe(5)
  })

  it("vier gegen neun Werte: kein Test, kein Urteil", () => {
    const result = compareSamples([1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(result?.test).toBeNull()
    expect(result?.verdict).toBe("unclear")
  })

  it("gleiche Werte: kein Unterschied, nicht bedeutsam", () => {
    const result = compareSamples([9.4, 9.4, 9.4, 9.4, 9.4], [9.4, 9.4, 9.4, 9.4, 9.4])
    expect(result?.verdict).toBe("unclear")
    expect(result?.meaningful).toBe(false)
  })

  it("eine leere Seite: null", () => {
    expect(compareSamples([1, 2, 3, 4, 5], [])).toBeNull()
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

  it("Einheit ist die Scheibe: das Mittel über die Scheiben, nicht über die Schüsse", () => {
    // 9, 10, 9, 10, 9 mit 60, 5, 60, 5, 60 Schuss: je Scheibe 9,4; nach Schüssen gewichtet wäre es 9,05
    const shotCounts = [60, 5, 60, 5, 60]
    const a = values([9, 10, 9, 10, 9]).map((v, i) => ({ ...v, n: shotCounts[i] }))
    const result = comparePeriods(a, values([9, 10, 9, 10, 9]))
    expect(result?.a.mean).toBeCloseTo(9.4, 12)
    expect(result?.delta).toBeCloseTo(0, 12)
    // zwei Scheiben mit vielen Schüssen geben kein Urteil
    const many = values([9.2, 9.3]).map((v) => ({ ...v, n: 60 }))
    expect(comparePeriods(many, values([9.8, 9.9, 10, 10.1, 10.2]))?.test).toBeNull()
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

  it("Grenze α 0,05: p 8/252 ist ein Urteil, p 14/252 nicht", () => {
    // U von a 2 (zwei Paare b < a): vier Aufteilungen mit U ≤ 2 je Seite → 8/252 = 0,0317
    const clear = comparePeriods(values([1, 2, 3, 5, 6]), values([4, 7, 8, 9, 10]))
    expect(clear?.test?.p).toBeCloseTo(8 / 252, 12)
    expect(clear?.verdict).toBe("higher")
    // U von a 3: sieben Aufteilungen mit U ≤ 3 je Seite → 14/252 = 0,0556
    const close = comparePeriods(values([1, 2, 4, 5, 6]), values([3, 7, 8, 9, 10]))
    expect(close?.test?.p).toBeCloseTo(14 / 252, 12)
    expect(close?.verdict).toBe("unclear")
  })

  it("Grenze bedeutsam: 0,3 · gepoolte Streuung (s 1,5811, Grenze 0,4743)", () => {
    const a = [8, 9, 10, 11, 12]
    expect(comparePeriods(values(a), values(a.map((v) => v + 0.48)))?.meaningful).toBe(true)
    expect(comparePeriods(values(a), values(a.map((v) => v + 0.47)))?.meaningful).toBe(false)
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

  it("31 Tage davor zählt nicht mehr", () => {
    const result = againstOwnAverage([at(9, 9), at(15, 9), at(39, 12), at(40, 10)])
    expect(result?.average).toBeNull()
  })

  it("Perzentil: kleinere ganz, gleiche zur Hälfte (mit ihr), ab zehn", () => {
    // die zwölf Werte aus dem Verlauf, die letzte ist 10: sechs kleiner, fünf gleich → (6 + 2,5) / 12
    const twelve = values([9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10])
    expect(againstOwnAverage(twelve)?.percentile).toBeCloseTo(8.5 / 12, 12)
    expect(againstOwnAverage(twelve.slice(0, 10))?.percentile).not.toBeNull()
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
