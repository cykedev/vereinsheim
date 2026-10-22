import { describe, expect, it } from "vitest"

import {
  c4,
  chiSquareCdfEven,
  chiSquareQuantileEven,
  chiSquareSurvival,
  fQuantile,
  fQuantile2,
  fSurvival,
  incompleteBeta,
  iqr,
  leastSquaresSlope,
  logGamma,
  mad,
  mannKendall,
  median,
  modalLength,
  quantile,
  theilSen,
  wilson,
  mannWhitney,
  normalTwoSided,
  permutationMeanTest,
} from "./stats"

describe("Lage- und Streumaße", () => {
  it("Quantil nach Typ 7 (linear zwischen den Rängen)", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([4, 3, 2, 1], 0.25)).toBe(1.75)
    expect(quantile([1, 2, 3, 4], 0)).toBe(1)
    expect(quantile([1, 2, 3, 4], 1)).toBe(4)
    expect(quantile([5], 0.9)).toBe(5)
    expect(quantile([], 0.5)).toBeNull()
    expect(() => quantile([1, 2], 1.5)).toThrow(RangeError)
  })

  it("Median, MAD und IQR", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(mad([1, 2, 3, 4, 100])).toBe(1)
    expect(iqr([1, 2, 3, 4])).toBe(1.5)
    expect(median([])).toBeNull()
    expect(mad([])).toBeNull()
    expect(iqr([])).toBeNull()
  })

  it("nur endliche Werte: NaN und unendlich sind ein Fehler, kein stilles Ergebnis", () => {
    expect(() => quantile([1, 2, Number.POSITIVE_INFINITY], 0.5)).toThrow(RangeError)
    expect(() => median([3, 1, Number.NaN, 2])).toThrow(RangeError)
    expect(() => mad([1, Number.NEGATIVE_INFINITY])).toThrow(RangeError)
    expect(() => iqr([Number.NaN])).toThrow(RangeError)
  })
})

describe("Quote mit Wilson-Intervall", () => {
  it("entspricht den Tabellenwerten", () => {
    const eight = wilson(8, 10)
    expect(eight?.low).toBeCloseTo(0.4902, 4)
    expect(eight?.high).toBeCloseTo(0.9433, 4)
    const none = wilson(0, 10)
    expect(none?.low).toBe(0)
    expect(none?.high).toBeCloseTo(0.2775, 4)
    const all = wilson(10, 10)
    expect(all?.low).toBeCloseTo(0.7225, 4)
    expect(all?.high).toBe(1)
  })

  it("ohne Versuche oder mit unmöglicher Zahl kein Intervall", () => {
    expect(wilson(0, 0)).toBeNull()
    expect(wilson(11, 10)).toBeNull()
    expect(wilson(2.5, 10)).toBeNull()
  })
})

describe("Gammafunktion und c4", () => {
  it("lnΓ an bekannten Stellen", () => {
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12)
    expect(logGamma(1)).toBeCloseTo(0, 12)
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12)
    expect(logGamma(101)).toBeCloseTo(363.73937555556347, 8)
    expect(() => logGamma(0)).toThrow(RangeError)
  })

  it("c4 wie in der Tabelle", () => {
    expect(c4(2)).toBeCloseTo(0.79788, 5)
    expect(c4(10)).toBeCloseTo(0.97266, 5)
    expect(c4(11)).toBeCloseTo(0.97535, 5)
    expect(() => c4(1)).toThrow(RangeError)
  })
})

describe("Quantile der χ²- und F-Verteilung", () => {
  it("χ² mit geraden Freiheitsgraden wie in der Tabelle", () => {
    expect(chiSquareQuantileEven(0.025, 2)).toBeCloseTo(0.0506, 4)
    expect(chiSquareQuantileEven(0.975, 2)).toBeCloseTo(7.3778, 4)
    expect(chiSquareQuantileEven(0.025, 10)).toBeCloseTo(3.247, 3)
    expect(chiSquareQuantileEven(0.975, 10)).toBeCloseTo(20.4832, 4)
    expect(chiSquareQuantileEven(0.025, 20)).toBeCloseTo(9.5908, 4)
    expect(chiSquareQuantileEven(0.975, 20)).toBeCloseTo(34.1696, 4)
    expect(chiSquareQuantileEven(0.975, 78)).toBeCloseTo(104.3159, 3)
  })

  it("Verteilungsfunktion: 0 bei 0, Kehrwert des Quantils", () => {
    expect(chiSquareCdfEven(0, 10)).toBe(0)
    expect(chiSquareCdfEven(chiSquareQuantileEven(0.3, 38), 38)).toBeCloseTo(0.3, 10)
    expect(() => chiSquareCdfEven(1, 3)).toThrow(RangeError)
  })

  it("F(2, ν) in geschlossener Form", () => {
    expect(fQuantile2(0.95, 2)).toBeCloseTo(19, 10)
    expect(fQuantile2(0.95, 3)).toBeCloseTo(9.5521, 4)
    expect(fQuantile2(0.95, 10)).toBeCloseTo(4.1028, 4)
    expect(() => fQuantile2(1, 10)).toThrow(RangeError)
  })
})

describe("Rand der F- und χ²-Verteilung", () => {
  it("F an den 95-%-Quantilen der Tabelle", () => {
    expect(fSurvival(4.1028, 2, 10)).toBeCloseTo(0.05, 4)
    expect(fSurvival(2.7109, 5, 20)).toBeCloseTo(0.05, 4)
    expect(fSurvival(4.1709, 1, 30)).toBeCloseTo(0.05, 4)
    expect(fSurvival(1.9267, 10, 100)).toBeCloseTo(0.05, 4)
  })

  it("F(2, ν) wie die geschlossene Form (1 + 2f/ν)^(−ν/2)", () => {
    expect(fSurvival(2.4, 2, 9)).toBeCloseTo(0.1461, 4)
    expect(fSurvival(0, 3, 7)).toBe(1)
  })

  it("Quantil der F-Verteilung wie in der Tabelle, Kehrwert des Rands", () => {
    expect(fQuantile(0.95, 2, 10)).toBeCloseTo(4.1028, 4)
    expect(fQuantile(0.95, 5, 20)).toBeCloseTo(2.7109, 4)
    // F(1, ν) = t²: das Quantil 0,95 ist t(6) zweiseitig 95 % = 2,4469, 0,975 ist zweiseitig 97,5 % = 2,9687 (Tabelle)
    expect(Math.sqrt(fQuantile(0.95, 1, 6))).toBeCloseTo(2.4469, 4)
    expect(Math.sqrt(fQuantile(0.975, 1, 6))).toBeCloseTo(2.9687, 4)
    expect(fSurvival(fQuantile(0.3, 3, 17), 3, 17)).toBeCloseTo(0.7, 10)
  })

  it("t mit 2 Freiheitsgraden als F(1, 2): 1 − t/√(t² + 2)", () => {
    expect(fSurvival(36.75, 1, 2)).toBeCloseTo(1 - Math.sqrt(36.75) / Math.sqrt(38.75), 8)
  })

  it("χ² an den 95-%-Quantilen der Tabelle, auch bei ungeraden Freiheitsgraden", () => {
    expect(chiSquareSurvival(3.8415, 1)).toBeCloseTo(0.05, 4)
    expect(chiSquareSurvival(7.8147, 3)).toBeCloseTo(0.05, 4)
    expect(chiSquareSurvival(18.307, 10)).toBeCloseTo(0.05, 4)
    expect(chiSquareSurvival(0, 4)).toBe(1)
  })

  it("χ² bei geraden Freiheitsgraden wie die geschlossene Form", () => {
    for (const [x, df] of [
      [2.5, 2],
      [11, 8],
      [40, 30],
    ] as const) {
      expect(chiSquareSurvival(x, df)).toBeCloseTo(1 - chiSquareCdfEven(x, df), 10)
    }
  })

  it("unvollständige Beta-Funktion an den Rändern und symmetrisch", () => {
    expect(incompleteBeta(2, 3, 0)).toBe(0)
    expect(incompleteBeta(2, 3, 1)).toBe(1)
    // I_x(1, 1) = x, I_x(a, b) = 1 − I_(1−x)(b, a)
    expect(incompleteBeta(1, 1, 0.3)).toBeCloseTo(0.3, 12)
    expect(incompleteBeta(2.5, 4, 0.4)).toBeCloseTo(1 - incompleteBeta(4, 2.5, 0.6), 12)
  })
})

describe("Theil-Sen", () => {
  const xs = Array.from({ length: 10 }, (_, i) => i)

  it("gerade Linie: Steigung, Achsenabschnitt, Intervall ohne Breite", () => {
    expect(
      theilSen(
        xs,
        xs.map((x) => 2 * x + 1)
      )
    ).toEqual({
      slope: 2,
      intercept: 1,
      low: 2,
      high: 2,
    })
  })

  it("ein Ausreißer verbiegt die Steigung nicht", () => {
    const ys = xs.map((x) => (x === 9 ? 100 : 2 * x + 1))
    const fit = theilSen(xs, ys)
    expect(fit?.slope).toBe(2)
    expect(fit?.intercept).toBe(1)
  })

  it("Rauschen ohne Trend: Intervall schließt 0 ein", () => {
    const ys = [10.4, 10.1, 10.6, 10.2, 10.5, 10.3, 10.6, 10.1, 10.4, 10.2]
    const fit = theilSen(xs, ys)
    expect(fit?.low).toBeLessThan(0)
    expect(fit?.high).toBeGreaterThan(0)
  })

  it("Sen-Intervall mit den Rängen (N − C)/2 und (N + C)/2 + 1, von Hand mit Brüchen gerechnet", () => {
    // 45 Steigungen, C = 1,96 · √(10 · 9 · 25 / 18) = 21,91: Ränge 12 und 34. Die Nachbarränge sind
    // −9/40 und −3/20 bzw. 11/70 und 1/5; ein Rangfehler fällt also auf.
    const ys = [10.7, 9.6, 9.7, 10.7, 10.4, 9.5, 9.9, 10.7, 9.5, 10.8]
    const fit = theilSen(xs, ys)
    expect(fit).not.toBeNull()
    expect(fit?.slope).toBeCloseTo(0, 12)
    expect(fit?.low).toBeCloseTo(-1 / 5, 12)
    expect(fit?.high).toBeCloseTo(11 / 60, 12)
  })

  it("zu wenige oder gleiche x: keine Gerade", () => {
    expect(theilSen([0, 1], [1, 2])).toBeNull()
    expect(theilSen([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(() => theilSen([1, 2, 3], [1, 2])).toThrow(RangeError)
  })

  it("unter sechs Punkten gibt es keinen 95-%-Bereich und deshalb keine Gerade", () => {
    // n = 5: (N − C)/2 = (10 − 8,0017)/2 < 1, der untere Rang läge unter dem kleinsten Wert
    expect(theilSen([0, 1, 2, 3, 4], [1, 3, 2, 5, 4])).toBeNull()
    expect(theilSen([0, 1, 2, 3, 4, 5], [1, 3, 2, 5, 4, 6])).not.toBeNull()
  })

  it("nicht endliche Werte sind ein Fehler", () => {
    expect(() => theilSen([0, 1, 2], [1, Number.NaN, 3])).toThrow(RangeError)
    expect(() => theilSen([0, Number.POSITIVE_INFINITY, 2], [1, 2, 3])).toThrow(RangeError)
  })
})

describe("Mann-Kendall und Ausgleichsgerade", () => {
  it("S, Varianz mit Bindungskorrektur und z mit Stetigkeitskorrektur (von Hand)", () => {
    // [1, 2, 3]: drei Paare steigen, Var = 3 · 2 · 11 / 18
    const plain = mannKendall([1, 2, 3])
    expect(plain?.s).toBe(3)
    expect(plain?.variance).toBeCloseTo(66 / 18, 12)
    expect(plain?.z).toBeCloseTo(2 / Math.sqrt(66 / 18), 12)
    // [1, 1, 2, 2]: vier Paare steigen, zwei sind gleich; Var = (4 · 3 · 13 − 2 · 2 · 1 · 9) / 18
    const tied = mannKendall([1, 1, 2, 2])
    expect(tied?.s).toBe(4)
    expect(tied?.variance).toBeCloseTo(120 / 18, 12)
    expect(tied?.z).toBeCloseTo(3 / Math.sqrt(120 / 18), 12)
    expect(mannKendall([2, 2, 1, 1])?.z).toBeCloseTo(-3 / Math.sqrt(120 / 18), 12)
  })

  it("die Stufe zehnmal 9, dann zehnmal 10: S 100, Varianz 700", () => {
    const step = [...Array<number>(10).fill(9), ...Array<number>(10).fill(10)]
    const fit = mannKendall(step)
    expect(fit?.s).toBe(100)
    expect(fit?.variance).toBeCloseTo(700, 9)
    expect(fit?.z).toBeCloseTo(99 / Math.sqrt(700), 12)
  })

  it("alle Werte gleich: kein Trend; unter drei Werten nichts", () => {
    expect(mannKendall([5, 5, 5, 5])).toEqual({ s: 0, variance: 0, z: 0 })
    expect(mannKendall([1, 2])).toBeNull()
    expect(() => mannKendall([1, Number.NaN, 3])).toThrow(RangeError)
  })

  it("Ausgleichsgerade: Steigung nach kleinsten Quadraten", () => {
    expect(leastSquaresSlope([0, 1, 2], [1, 3, 5])).toBeCloseTo(2, 12)
    // x̄ 1,5, ȳ 2: Σ(x − x̄)(y − ȳ) = 3, Σ(x − x̄)² = 5
    expect(leastSquaresSlope([0, 1, 2, 3], [1, 2, 2, 3])).toBeCloseTo(0.6, 12)
    expect(leastSquaresSlope([1, 1, 1], [1, 2, 3])).toBeNull()
    // 0,1 ist binär nicht exakt: Der Mittelwert weicht im letzten Bit ab, Σ(x − x̄)² wäre nicht 0
    const ys = [20.6, 11.3, 2.1, 16.5, 7.2, 21.6, 12.4]
    expect(leastSquaresSlope(Array<number>(7).fill(0.1), ys)).toBeNull()
    expect(leastSquaresSlope([1], [1])).toBeNull()
    expect(() => leastSquaresSlope([1, 2, 3], [1, 2])).toThrow(RangeError)
  })
})

describe("Mann-Whitney und Normalverteilung", () => {
  it("zweiseitiger p-Wert der Normalverteilung", () => {
    expect(normalTwoSided(1.959964)).toBeCloseTo(0.05, 6)
    expect(normalTwoSided(-1.959964)).toBeCloseTo(0.05, 6)
    expect(normalTwoSided(0)).toBeCloseTo(1, 7)
  })

  it("genau ausgezählt: vollständig getrennte Gruppen", () => {
    const three = mannWhitney([1, 2, 3], [4, 5, 6])
    expect(three).toEqual({ u: 0, p: expect.any(Number), exact: true })
    // nur die zwei äußersten der 20 Aufteilungen sind so weit weg
    expect(three?.p).toBeCloseTo(2 / 20, 12)
    expect(mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])?.p).toBeCloseTo(2 / 252, 12)
  })

  it("gleiche Werte mit mittleren Rängen, gegen ein eigenes Durchzählen", () => {
    // Ränge 1, 3, 3, 3, 5, 6; a = [1, 2, 2] hat die Rangsumme 7, Erwartung 10,5
    const ranks = [1, 3, 3, 3, 5, 6]
    let far = 0
    let all = 0
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++)
        for (let k = j + 1; k < 6; k++) {
          all++
          if (Math.abs(ranks[i] + ranks[j] + ranks[k] - 10.5) >= 3.5 - 1e-9) far++
        }
    expect(far / all).toBeCloseTo(0.3, 12)
    expect(mannWhitney([1, 2, 2], [2, 3, 4])?.p).toBeCloseTo(far / all, 12)
  })

  it("über 20 Werten je Seite die Normalnäherung mit Stetigkeitskorrektur", () => {
    const a = Array.from({ length: 21 }, (_, i) => i + 1)
    const b = a.map((v) => v + 0.5)
    // U von a: Σ(i − 1) = 210, Erwartung 220,5, Varianz 21 · 21 · 43 / 12 = 1580,25
    // z = (10,5 − 0,5) / 39,7524 = 0,25156, p = erfc(z / √2) = 0,80138
    const result = mannWhitney(a, b)
    expect(result?.exact).toBe(false)
    expect(result?.u).toBe(210)
    expect(result?.p).toBeCloseTo(0.80138, 4)
  })

  it("über 20 je Seite mit Korrektur für gleiche Werte", () => {
    // elf Einsen und zehn Zweien gegen zehn Einsen und elf Zweien: mittlere Ränge 11 und 32, U von a 210;
    // Varianz 441/12 · (43 − 2 · (21³ − 21) / (42 · 41)) = 1185,86, z = 10 / 34,436 = 0,29039,
    // p = 0,77152 (ohne die Korrektur 0,80138)
    const a = [...Array<number>(11).fill(1), ...Array<number>(10).fill(2)]
    const b = [...Array<number>(10).fill(1), ...Array<number>(11).fill(2)]
    const result = mannWhitney(a, b)
    expect(result?.exact).toBe(false)
    expect(result?.u).toBe(210)
    expect(result?.p).toBeCloseTo(0.77152, 4)
  })

  it("ohne Werte auf einer Seite kein Ergebnis", () => {
    expect(mannWhitney([], [1, 2])).toBeNull()
    expect(mannWhitney([1], [])).toBeNull()
  })
})

describe("modalLength", () => {
  it("der häufigste Wert, bei Gleichstand der größere, ohne Werte null", () => {
    expect(modalLength([])).toBeNull()
    expect(modalLength([10, 10, 10, 4])).toBe(10)
    expect(modalLength([5, 5, 10, 10])).toBe(10)
    expect(modalLength([10, 5, 5])).toBe(5)
  })
})

describe("Permutationstest auf den Unterschied der Mittel", () => {
  it("zählt alle Auswahlen genau aus (Handwerte)", () => {
    // eine von vier Auswahlen (die 10) liegt so weit vom Rest
    expect(permutationMeanTest([10], [0, 0, 0])).toEqual({ p: 1 / 4 })
    // nur die Auswahl der drei Neunen aus 40 Werten: C(40, 3) = 9 880
    expect(
      permutationMeanTest(
        [9, 9, 9],
        Array.from({ length: 37 }, () => 5)
      )
    ).toEqual({
      p: 1 / 9880,
    })
    // alles gleich: jede Auswahl ist so weit weg wie die beobachtete
    expect(permutationMeanTest([5, 5, 5], [5, 5, 5, 5])).toEqual({ p: 1 })
    // zwei aus [1, 2, 3, 4]: {1, 2} und {3, 4} sind die äußersten, 2 von 6
    expect(permutationMeanTest([1, 2], [3, 4])).toEqual({ p: 2 / 6 })
  })

  it("zweiseitig: gespiegelte Werte geben dasselbe p", () => {
    const rest = [95, 98, 100, 101, 103, 97, 99, 102, 100, 96]
    const high = permutationMeanTest([104, 106, 103], rest)!
    const low = permutationMeanTest(
      [104, 106, 103].map((v) => -v),
      rest.map((v) => -v)
    )!
    expect(high.p).toBe(low.p)
    expect(high.p).toBeLessThan(0.05)
  })

  it("nur für bis zu drei Werte, nur ganze Zahlen, sonst ohne Seite null", () => {
    expect(() => permutationMeanTest([1, 2, 3, 4], [5, 6])).toThrow(RangeError)
    expect(() => permutationMeanTest([1.5], [2, 3])).toThrow(RangeError)
    expect(permutationMeanTest([], [1, 2])).toBeNull()
    expect(permutationMeanTest([1], [])).toBeNull()
  })
})
