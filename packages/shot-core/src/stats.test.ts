import { describe, expect, it } from "vitest"

import {
  c4,
  chiSquareCdfEven,
  chiSquareQuantileEven,
  fQuantile2,
  iqr,
  logGamma,
  mad,
  median,
  quantile,
  theilSen,
  wilson,
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
