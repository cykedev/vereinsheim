import { describe, expect, it } from "vitest"

import { metricByKey, type MetricDefinition } from "../metrics"
import { c4, fQuantile, fSurvival } from "../stats"
import { confidenceOf } from "./hotelling"
import {
  axisGroups,
  compareValues,
  levelCompare,
  levelCompareByAxis,
  levelEstimate,
  levelTestZero,
  levelTestZeroByAxis,
  pooledValue,
  shotGroup,
  WANDER_ALPHA,
} from "./levels"
import type { CardValue } from "./period"

const ones = (values: readonly number[]) => shotGroup(values.map((v) => [v]))
const points = (list: readonly (readonly [number, number])[]) =>
  shotGroup(list.map(([x, y]) => [x, y]))

describe("eine Scheibe als Gruppe von Schüssen", () => {
  it("Zahl, Mittel und Abweichungsquadrate um das Mittel", () => {
    expect(ones([1, 2, 3, 4])).toEqual({ n: 4, mean: [2.5], scatter: [5] })
    // (0|0), (2|0), (0|2): Mitte (2/3|2/3)
    const g = points([
      [0, 0],
      [2, 0],
      [0, 2],
    ])
    expect(g.n).toBe(3)
    expect(g.mean[0]).toBeCloseTo(2 / 3, 12)
    expect(g.scatter[0]).toBeCloseTo(8 / 3, 12)
    expect(g.scatter[1]).toBeCloseTo(8 / 3, 12)
    expect(g.scatter[2]).toBeCloseTo(-4 / 3, 12)
  })
})

describe("zwei Ebenen: Schüsse in Scheiben", () => {
  it("die Abende wandern: Vortest unter `WANDER_ALPHA`, Unsicherheit der Abende (Hand-Rechnung)", () => {
    const e = levelEstimate([ones([1, 2, 3, 4]), ones([2, 3, 4, 5]), ones([3, 4, 5, 6])])
    expect(e).not.toBeNull()
    if (!e) return
    // W = 15/9, M = 4, F = 2,4 mit (2, 9): (1 + 2 · 2,4/9)^(−4,5)
    expect(e.wanderP).toBeCloseTo(0.1461, 4)
    expect(e.wanderP).toBeLessThan(WANDER_ALPHA)
    expect(e.wander).toBe(true)
    expect(e.mean[0]).toBeCloseTo(3.5, 12)
    // n₀ = 4, B = (4 − 15/9)/4, V = (B · 48 + W · 12)/144 = 1/3, ν = k − 1
    expect(e.cov[0]).toBeCloseTo(1 / 3, 12)
    expect(e.df).toBe(2)
    expect(e.shots).toBe(12)
    expect(e.groups).toBe(3)
    const test = levelTestZero(e)
    expect(test).not.toBeNull()
    expect(test?.t2).toBeCloseTo(36.75, 10)
    // t mit 2 Freiheitsgraden: p = 1 − t/√(t² + 2)
    expect(test?.p).toBeCloseTo(1 - Math.sqrt(36.75) / Math.sqrt(38.75), 8)
  })

  it("die Abende wandern nicht: alle Schüsse als eine Stichprobe (Hand-Rechnung)", () => {
    const e = levelEstimate([ones([1, 3]), ones([1, 3]), ones([1, 3])])
    expect(e).not.toBeNull()
    if (!e) return
    expect(e.wanderP).toBe(1)
    expect(e.wander).toBe(false)
    // T = (6 + 0)/5, V = T/6, ν = N − 1
    expect(e.cov[0]).toBeCloseTo(0.2, 12)
    expect(e.df).toBe(5)
    const test = levelTestZero(e)
    expect(test?.t2).toBeCloseTo(20, 10)
    // t(5) zweiseitig: 4,032 bei 0,01, 4,773 bei 0,005; √20 = 4,47
    expect(test?.p).toBeGreaterThan(0.005)
    expect(test?.p).toBeLessThan(0.01)
  })

  it("ohne Wandern in zwei Richtungen gleich Hotelling über alle Schüsse", () => {
    const pattern: [number, number][] = [
      [1000, 2000],
      [3000, 2500],
      [2000, 4000],
      [1500, 1000],
    ]
    const e = levelEstimate([points(pattern), points(pattern), points(pattern)])
    expect(e?.wander).toBe(false)
    const all = [...pattern, ...pattern, ...pattern].map(([xUm, yUm]) => ({ xUm, yUm }))
    expect(levelTestZero(e!)?.t2).toBeCloseTo(confidenceOf(all)!.t2, 8)
  })

  it("eine Drehung um 90° ändert nichts am Urteil", () => {
    const cards: [number, number][][] = [
      [
        [1000, 2000],
        [3000, 2500],
        [2000, 4000],
      ],
      [
        [4000, 1000],
        [6000, 3500],
        [5000, 2000],
      ],
      [
        [-1000, 3000],
        [500, 6000],
        [0, 4500],
      ],
      [
        [2500, -500],
        [3500, 1500],
        [1500, 500],
      ],
    ]
    const turned = cards.map((card) => card.map(([x, y]) => [-y, x] as [number, number]))
    const a = levelTestZero(levelEstimate(cards.map(points))!)
    const b = levelTestZero(levelEstimate(turned.map(points))!)
    expect(a).not.toBeNull()
    expect(b?.p).toBeCloseTo(a!.p, 10)
    expect(b?.t2).toBeCloseTo(a!.t2, 8)
  })

  it("unter zwei Scheiben oder ohne Streuung innerhalb der Scheiben keine Schätzung", () => {
    expect(levelEstimate([ones([1, 2, 3])])).toBeNull()
    expect(levelEstimate([ones([2, 2]), ones([3, 3])])).toBeNull()
    expect(levelEstimate([])).toBeNull()
  })
})

describe("Lage je Richtung", () => {
  // seitlich wie die wandernden Abende oben, in der Höhe ohne Wandern: je Scheibe 1, 3, 1, 3
  const cards = [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
  ].map((xs) => shotGroup(xs.map((x, i) => [x, i % 2 ? 3 : 1])))

  it("eine Richtung aus Gruppen in zwei", () => {
    expect(axisGroups(cards, 0)[0]).toEqual({ n: 4, mean: [2.5], scatter: [5] })
    expect(axisGroups(cards, 1)[0]).toEqual({ n: 4, mean: [2], scatter: [4] })
  })

  it("je Richtung eigener Vortest und eigene Freiheitsgrade, zusammen nach Bonferroni (Hand-Rechnung)", () => {
    const test = levelTestZeroByAxis(cards)
    expect(test).not.toBeNull()
    expect(test?.wanderAxes).toEqual({ x: true, y: false })
    // seitlich wie oben p = 0,0261 mit 2 Freiheitsgraden; in der Höhe W = 12/9, M = 0, T = 12/11, V = 1/11, ν = 11,
    // t² = 2²/(1/11) = 44
    const px = 1 - Math.sqrt(36.75) / Math.sqrt(38.75)
    const py = fSurvival(44, 1, 11)
    expect(test?.p).toBeCloseTo(Math.min(1, 2 * Math.min(px, py)), 12)
    expect(test?.wander).toBe(true)
  })

  it("Bereich der Mitte je Richtung: t zweiseitig 97,5 % mal √V (Hand-Rechnung)", () => {
    const region = levelTestZeroByAxis(cards)?.region
    // Höhe: V = 1/11, ν = 11; seitlich mit Wandern: V = 1/3, ν = 2
    expect(region?.y).toBeCloseTo(Math.sqrt(fQuantile(0.975, 1, 11) / 11), 10)
    expect(region?.x).toBeCloseTo(Math.sqrt(fQuantile(0.975, 1, 2) / 3), 10)
  })

  it("der Bereich schließt die Mitte der Scheibe genau dann aus, wenn versetzt", () => {
    let seed = 7
    const next = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647 - 0.5
    }
    for (let run = 0; run < 300; run++) {
      const offset = [next() * 2, next() * 2]
      const groups = Array.from({ length: 5 + (run % 6) }, () => {
        const center = [offset[0] + next() * 2 * (run % 3), offset[1] + next()]
        return shotGroup(
          Array.from({ length: 8 }, () => [center[0] + next() * 4, center[1] + next() * 4])
        )
      })
      const test = levelTestZeroByAxis(groups)
      const e = levelEstimate(groups)
      if (!test || !e) continue
      const outside = Math.abs(e.mean[0]) > test.region.x || Math.abs(e.mean[1]) > test.region.y
      expect(outside, `Lauf ${run}`).toBe(test.p < 0.05)
    }
  })

  it("zwei Seiten je Richtung: gleiche Seiten p 1, Unterschied mit Vorzeichen", () => {
    expect(levelCompareByAxis(cards, cards)?.p).toBe(1)
    const moved = cards.map((g) => ({ ...g, mean: [g.mean[0], g.mean[1] + 2] }))
    const result = levelCompareByAxis(cards, moved)
    expect(result?.delta[1]).toBeCloseTo(-2, 12)
    expect(result?.p).toBeLessThan(0.05)
  })
})

describe("zwei Seiten über zwei Ebenen", () => {
  const a = levelEstimate([ones([1, 2, 3, 4]), ones([2, 3, 4, 5]), ones([3, 4, 5, 6])])!
  const b = levelEstimate([ones([1, 3]), ones([1, 3]), ones([1, 3])])!

  it("gleiche Seiten: kein Unterschied", () => {
    const same = levelCompare(a, a)
    expect(same?.delta[0]).toBe(0)
    expect(same?.p).toBe(1)
  })

  it("vertauscht: Unterschied mit anderem Vorzeichen, gleiches p", () => {
    const ab = levelCompare(a, b)
    const ba = levelCompare(b, a)
    expect(ab?.delta[0]).toBeCloseTo(1.5, 12)
    expect(ba?.delta[0]).toBeCloseTo(-1.5, 12)
    expect(ba?.p).toBeCloseTo(ab!.p, 12)
    // Welch: V = 1/3 + 0,2, ν = V²/((1/3)²/2 + 0,2²/5)
    const v = 1 / 3 + 0.2
    expect(ab?.df).toBeCloseTo(v ** 2 / ((1 / 3) ** 2 / 2 + 0.2 ** 2 / 5), 10)
    expect(ab?.t2).toBeCloseTo(1.5 ** 2 / v, 10)
  })
})

const metric = (key: string) => metricByKey(key) as MetricDefinition
const card = (i: number, value: number, n: number, sd?: number | null): CardValue => ({
  id: `c${i}`,
  atMs: i,
  value,
  n,
  ...(sd !== undefined ? { sd } : {}),
})
const many = (list: readonly (readonly [number, number, (number | null)?])[]) =>
  list.map(([value, n, sd], i) => card(i, value, n, sd))

describe("Werte über alle Schüsse", () => {
  it("Ø je Schuss: eine Scheibe mit 40 Schuss zählt viermal so viel wie eine mit 10", () => {
    const values = many([
      [9, 10],
      [10, 40],
    ])
    expect(pooledValue(values, metric("result.decimalMean"))).toBeCloseTo(9.8, 12)
    expect(pooledValue(values, metric("result.ringsMean"))).toBeCloseTo(9.8, 12)
    expect(pooledValue(values, metric("result.tensRate"))).toBeCloseTo(9.8, 12)
  })

  it("auf dem Raster der Wertung: 3202 Zehntel auf 40 und 4803 auf 60 sind genau 8,005", () => {
    const values = many([
      [8.005, 40],
      [8.005, 60],
    ])
    expect(pooledValue(values, metric("result.decimalMean"))).toBe(8.005)
  })

  it("Streuung einer Richtung über ν = n − 1, Rayleigh-σ über ν = 2(n − 1) mit c4", () => {
    // √((2 · 1² + 4 · 2²)/6) = √3
    const axis = many([
      [1, 3],
      [2, 5],
    ])
    expect(pooledValue(axis, metric("group.sdX"))).toBeCloseTo(Math.sqrt(3), 12)
    const sigma = many([
      [1, 3],
      [1, 3],
    ])
    // je Scheibe s = σ̂ · c4(5), ν = 4; gepoolt √(s²) / c4(9)
    expect(pooledValue(sigma, metric("group.sigma"))).toBeCloseTo(c4(5) / c4(9), 12)
  })

  it("ohne Pooling das Mittel der Werte je Scheibe, ohne Werte null", () => {
    const values = many([
      [380, 40],
      [90, 10],
    ])
    expect(pooledValue(values, metric("result.decimal"))).toBe(235)
    expect(pooledValue([], metric("result.decimalMean"))).toBeNull()
  })
})

describe("zwei Zeiträume über die Schüsse", () => {
  const mean = metric("result.decimalMean")
  const fives = (value: number, sd: number) =>
    many(Array.from({ length: 5 }, () => [value, 40, sd] as const))

  it("gleiche Abende: jeder Schuss zählt, ein klarer Unterschied", () => {
    const result = compareValues(fives(9.5, 0.5), fives(9.7, 0.5), mean)
    expect(result?.basis).toBe("shots")
    expect(result?.delta).toBeCloseTo(0.2, 12)
    expect(result?.verdict).toBe("higher")
    expect(result?.test?.p).toBeLessThan(0.001)
  })

  it("wandernde Abende: jeder Abend zählt für sich", () => {
    const a = many([
      [9, 40, 0.3],
      [10, 40, 0.3],
      [9, 40, 0.3],
      [10, 40, 0.3],
      [9.5, 40, 0.3],
    ])
    const result = compareValues(a, fives(9.5, 0.3), mean)
    expect(result?.basis).toBe("evenings")
    expect(result?.verdict).toBe("unclear")
  })

  it("Mittel über die Schüsse, nicht Mittel der Mittel: kurze Scheiben zählen weniger", () => {
    // A: Mittel der Mittel 9,4, über die Schüsse 1280/140 = 9,142857…; B: 9,3. Nur über die Schüsse liegt B höher.
    const a = many([
      [10, 10, 0.5],
      [10, 10, 0.5],
      [9, 40, 0.5],
      [9, 40, 0.5],
      [9, 40, 0.5],
    ])
    const result = compareValues(a, fives(9.3, 0.5), mean)
    expect(result?.a.mean).toBeCloseTo(1280 / 140, 12)
    expect(result?.b.mean).toBeCloseTo(9.3, 12)
    expect(result?.delta).toBeGreaterThan(0)
  })

  it("ohne Streuung der Schusswerte (Einheiten nur aus Serien) der Rangtest über die Scheiben", () => {
    const a = many(Array.from({ length: 5 }, (_, i) => [9 + i / 10, 30] as const))
    const b = many(Array.from({ length: 5 }, (_, i) => [9.6 + i / 10, 30] as const))
    const result = compareValues(a, b, mean)
    expect(result?.basis).toBe("cards")
    expect(result?.test?.exact).toBe(true)
  })

  it("unter fünf Scheiben je Seite kein Urteil", () => {
    const result = compareValues(fives(9.5, 0.5).slice(0, 4), fives(9.9, 0.5), mean)
    expect(result?.test).toBeNull()
    expect(result?.verdict).toBe("unclear")
    expect(result?.meaningful).toBeNull()
  })

  it("Streuung: ohne Wandern der F-Test über die gepoolten Varianzen", () => {
    const sd = metric("group.sdX")
    const a = many(Array.from({ length: 5 }, () => [1, 11] as const))
    const b = many(Array.from({ length: 5 }, () => [2, 11] as const))
    const result = compareValues(a, b, sd)
    expect(result?.basis).toBe("shots")
    expect(result?.a.mean).toBeCloseTo(1, 12)
    expect(result?.b.mean).toBeCloseTo(2, 12)
    // F = 4 mit (50, 50), zweiseitig
    expect(result?.test?.p).toBeCloseTo(2 * fSurvival(4, 50, 50), 12)
    expect(result?.verdict).toBe("higher")
  })

  it("Streuung: wandernde Präzision zählt jeden Abend für sich", () => {
    const sd = metric("group.sdX")
    const a = many(Array.from({ length: 5 }, () => [1, 11] as const))
    const b = many([1, 3, 1, 3, 2].map((v) => [v, 11] as const))
    const result = compareValues(a, b, sd)
    expect(result?.basis).toBe("evenings")
    expect(result?.delta).toBeGreaterThan(0)
  })
})
