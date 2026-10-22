import { describe, expect, it } from "vitest"

import { confidenceOf } from "./hotelling"
import { levelCompare, levelEstimate, levelTestZero, shotGroup, WANDER_ALPHA } from "./levels"

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
  it("die Abende wandern: Vortest unter 0,25, Unsicherheit der Abende (Hand-Rechnung)", () => {
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
