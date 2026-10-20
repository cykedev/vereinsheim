import { describe, expect, it } from "vitest"

import { MATCH } from "../__fixtures__/cards"
import { r50 } from "../geometry"
import type { MetricShot } from "../metrics"
import {
  cardTrend,
  fatigue,
  longestRun,
  movingAverage,
  mpiPath,
  seriesCurve,
  seriesSpread,
} from "./course"

const shot = (i: number, decimalTenths: number, xUm = 0, yUm = 0, series = 1): MetricShot => ({
  ...MATCH[0],
  seq: i + 1,
  firedAtMs: i * 40_000,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen: false,
  xUm,
  yUm,
  series,
})

// Zehn ganzzahlige Punkte symmetrisch um (0 | 0): sechs auf den Achsen im Abstand r, vier diagonal
// (a | a) mit a ≈ r/√2. Der Schwerpunkt liegt genau in der Mitte, der Median der Abstände genau bei r.
const ring = (radius: number, k: number) => {
  const a = Math.round(radius / Math.SQRT2)
  const points = [
    [radius, 0],
    [0, radius],
    [-radius, 0],
    [0, -radius],
    [a, a],
    [-a, a],
    [-a, -a],
    [a, -a],
    [radius, 0],
    [-radius, 0],
  ]
  return points[k]
}

// Zwanzig Schuss: die ersten zehn 10,5 eng (Radius 0,5 mm), die letzten zehn 10,1 weiter (1,5 mm).
const TIRED: MetricShot[] = Array.from({ length: 20 }, (_, i) => {
  const [x, y] = ring(i < 10 ? 500 : 1500, i % 10)
  return shot(i, i < 10 ? 105 : 101, x, y, i < 10 ? 1 : 2)
})

describe("Serienkurve, Streuung und Schwerpunkt je Serie (I1, I5, I6)", () => {
  it("Serien in Reihenfolge, in Zehnteln und in ganzen Ringen", () => {
    expect(seriesCurve(TIRED, "decimal")).toEqual([
      { series: 1, shots: 10, total: 105 },
      { series: 2, shots: 10, total: 101 },
    ])
    expect(seriesCurve(TIRED, "rings")).toEqual([
      { series: 1, shots: 10, total: 100 },
      { series: 2, shots: 10, total: 100 },
    ])
  })

  it("ohne Zehntel gibt es die Summen nur in ganzen Ringen (SF-18)", () => {
    const ringsOnly = TIRED.map((s) => ({ ...s, decimalTenths: null }))
    expect(seriesCurve(ringsOnly, "decimal")).toEqual([
      { series: 1, shots: 10, total: null },
      { series: 2, shots: 10, total: null },
    ])
    expect(seriesCurve(ringsOnly, "rings").map((s) => s.total)).toEqual([100, 100])
  })

  it("fehlt einem Schuss der Wert, hat seine Serie keine Summe, wie das Ergebnis", () => {
    const gap = TIRED.map((s, i) => (i === 4 ? { ...s, decimalTenths: null } : s))
    expect(seriesCurve(gap, "decimal")).toEqual([
      { series: 1, shots: 10, total: null },
      { series: 2, shots: 10, total: 101 },
    ])
  })

  it("R50 je Serie", () => {
    const spread = seriesSpread(TIRED)
    expect(spread.map((s) => s.series)).toEqual([1, 2])
    expect(spread[0].r50Um).toBe(500)
    expect(spread[1].r50Um).toBe(1500)
  })

  it("Schwerpunkt je Serie und Abstand zum Scheiben-Schwerpunkt", () => {
    const shifted = TIRED.map((s) => (s.series === 2 ? { ...s, xUm: (s.xUm as number) + 2000 } : s))
    const path = mpiPath(shifted)
    expect(path).toHaveLength(2)
    expect(path[0].center.xUm).toBeCloseTo(0, 6)
    expect(path[1].center.xUm).toBeCloseTo(2000, 6)
    expect(path[0].offsetUm).toBeCloseTo(1000, 6)
    expect(path[1].offsetUm).toBeCloseTo(1000, 6)
  })
})

describe("Ermüdung und Trend (I2, I3)", () => {
  it("letzte zehn minus erste zehn, im Wert und im R50", () => {
    const tired = fatigue(TIRED, "decimal")
    expect(tired?.deltaRings).toBeCloseTo(-0.4, 9)
    const firstTen = TIRED.slice(0, 10).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
    const lastTen = TIRED.slice(10).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
    expect(tired?.deltaR50Um).toBeCloseTo((r50(lastTen) as number) - (r50(firstTen) as number), 9)
    expect(fatigue(TIRED.slice(0, 19), "decimal")).toBeNull()
  })

  it("in ganzen Ringen sind 10,5 und 10,1 beide eine 10", () => {
    const tired = fatigue(TIRED, "rings")
    expect(tired?.firstMeanRings).toBe(10)
    expect(tired?.deltaRings).toBe(0)
  })

  // Folge von Zehntelwerten als Wertungsschüsse in Abgabefolge, alle in der Mitte
  const valued = (tenths: readonly number[]) => tenths.map((t, i) => shot(i, t))
  const ten = (t: number) => Array.from({ length: 10 }, () => t)

  it("klar schwächer oder stärker nach Mann-Whitney, in beiden Wertungen", () => {
    // zehnmal 10,8, dann zehnmal 9,2: jeder der letzten zehn unter jedem der ersten (in ganzen Ringen 10 gegen 9)
    const down = valued([...ten(108), ...ten(92)])
    for (const scoring of ["decimal", "rings"] as const) {
      expect(fatigue(down, scoring)).toMatchObject({ clear: true, direction: "down" })
    }
    expect(fatigue(valued([...ten(92), ...ten(108)]), "decimal")).toMatchObject({
      clear: true,
      direction: "up",
    })
  })

  it("kein Urteil, wenn die Werte nur schwanken", () => {
    const alternating = valued(Array.from({ length: 20 }, (_, i) => (i % 2 ? 99 : 101)))
    expect(fatigue(alternating, "decimal")).toMatchObject({ clear: false, direction: null })
  })

  it("der Test urteilt, nicht die Größe des Unterschieds", () => {
    // die letzten zehn je 0,5 Ringe unter den ersten zehn, aber weit gestreut: kein Urteil
    const first = [109, 70, 108, 71, 107, 72, 106, 73, 105, 74]
    const tired = fatigue(valued([...first, ...first.map((t) => t - 5)]), "decimal")
    expect(tired?.deltaRings).toBeCloseTo(-0.5, 9)
    expect(tired).toMatchObject({ clear: false, direction: null })
  })

  it("kein Urteil, wenn Test und Mittel in verschiedene Richtungen zeigen", () => {
    // neun der letzten zehn über allen ersten, einer weit darunter: Ränge steigen, das Mittel fällt
    const tired = fatigue(
      valued([...ten(100), ...Array.from({ length: 9 }, () => 105), 30]),
      "decimal"
    )
    expect(tired?.deltaRings).toBeCloseTo(-0.25, 9)
    expect(tired).toMatchObject({ clear: false, direction: null })
  })

  it("Trend je zehn Schuss: Ausgleichsgerade, klar nach Mann-Kendall, ohne Intervall", () => {
    const rising = Array.from({ length: 20 }, (_, i) => shot(i, 90 + i))
    const trend = cardTrend(rising, "decimal")
    expect(trend?.perTenShots).toBeCloseTo(1, 9)
    expect(trend).toMatchObject({ clear: true, direction: "up" })
    expect(Object.keys(trend ?? {}).sort()).toEqual(["clear", "direction", "n", "perTenShots"])
    const noisy = [104, 101, 106, 102, 105, 103, 106, 101, 104, 102].map((v, i) => shot(i, v))
    expect(cardTrend(noisy, "decimal")).toMatchObject({ clear: false, direction: null })
    expect(cardTrend(noisy.slice(0, 9), "decimal")).toBeNull()
  })

  it("der Trend rechnet auf den echten Schussnummern, auch wenn ein Wert fehlt", () => {
    // 20 Schuss steigen um 0,1 je Schuss; Schuss 10 hat keinen Wert. Auf Positionen statt Nummern
    // wäre die Steigung über der Lücke größer.
    const rising = Array.from({ length: 20 }, (_, i) => shot(i, 90 + i)).map((s, i) =>
      i === 9 ? { ...s, decimalTenths: null } : s
    )
    const trend = cardTrend(rising, "decimal")
    expect(trend?.n).toBe(19)
    expect(trend?.perTenShots).toBeCloseTo(1, 9)
    expect(trend?.direction).toBe("up")
  })

  it("in ganzen Ringen ist die Stufe von 9 auf 10 klar steigend, auch mit vielen gleichen Werten", () => {
    // 9,0 … 10,9: zehnmal Ring 9, dann zehnmal Ring 10, die stärkste mögliche Anordnung
    // (1/C(20, 10)). Mann-Kendall mit Bindungen: S 100, Var 700, z = 99/√700 ≈ 3,74. Ein
    // Sen-Intervall läge hier bei [0; 0,83] und hieße „nicht klar“.
    const rising = Array.from({ length: 20 }, (_, i) => shot(i, 90 + i))
    const rings = cardTrend(rising, "rings")
    expect(rings).toMatchObject({ clear: true, direction: "up" })
    // Ausgleichsgerade durch zehnmal 9 und zehnmal 10: Σ(x − x̄)(y − ȳ) = 50, Σ(x − x̄)² = 665
    expect(rings?.perTenShots).toBeCloseTo(500 / 665, 9)
    const falling = Array.from({ length: 20 }, (_, i) => shot(i, 109 - i))
    expect(cardTrend(falling, "rings")).toMatchObject({ clear: true, direction: "down" })
  })

  it("lauter gleiche Werte sind kein Trend; ein einzelner Nuller am Ende ist nicht klar", () => {
    const flat = Array.from({ length: 20 }, (_, i) => shot(i, 100))
    expect(cardTrend(flat, "rings")).toEqual({
      n: 20,
      perTenShots: 0,
      clear: false,
      direction: null,
    })
    // 19 Zehner und am Ende ein Nuller: S −19, Var (17100 − 14706)/18 = 133, z = −18/√133 ≈ −1,56
    const lastMiss = Array.from({ length: 20 }, (_, i) => shot(i, i === 19 ? 0 : 100))
    const trend = cardTrend(lastMiss, "rings")
    expect(trend).toMatchObject({ clear: false, direction: null })
    // die Steigung zeigt den Nuller trotzdem: Σ(x − x̄)(y − ȳ) = −95, Σ(x − x̄)² = 665
    expect(trend?.perTenShots).toBeCloseTo(-950 / 665, 9)
  })

  it("widersprechen sich Rangtest und Gerade, gibt es kein Urteil", () => {
    // Fünfmal 8, sechsmal 9, achtmal 10, dann ein Fehlschuss: Fast jeder spätere Schuss ist besser
    // (S 99, Var 15114/18, z ≈ 3,38), der Nuller am Ende zieht die Gerade aber ins Minus:
    // Σ(x − x̄)(y − ȳ) = −8, Σ(x − x̄)² = 665. „Klar steigend“ neben einer fallenden Zahl wäre falsch.
    const rings = [...Array(5).fill(80), ...Array(6).fill(90), ...Array(8).fill(100), 0]
    const trend = cardTrend(
      rings.map((v, i) => shot(i, v)),
      "rings"
    )
    expect(trend?.perTenShots).toBeCloseTo(-80 / 665, 9)
    expect(trend).toMatchObject({ clear: false, direction: null })
  })
})

describe("Gleitender Schnitt und längste Folge (I4, I10)", () => {
  it("Ø der letzten bis zu zehn, am Anfang als Teilfenster gekennzeichnet", () => {
    const values = Array.from({ length: 12 }, (_, i) => shot(i, 98 + i))
    const average = movingAverage(values, "decimal", 10)
    expect(average[0]).toEqual({ number: 1, value: 9.8, meanRings: 9.8, partial: true })
    expect(average[9]).toMatchObject({ number: 10, partial: false })
    expect(average[9].meanRings).toBeCloseTo(10.25, 9)
    expect(average[11].meanRings).toBeCloseTo(10.45, 9)
  })

  it("Nummern bleiben die Schussnummern, auch wenn ein Wert fehlt", () => {
    const values = Array.from({ length: 10 }, (_, i) => shot(i, 100)).map((s, i) =>
      i === 2 ? { ...s, decimalTenths: null } : s
    )
    expect(movingAverage(values, "decimal", 10).map((p) => p.number)).toEqual([
      1, 2, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(() => movingAverage(values, "decimal", 0)).toThrow(RangeError)
  })

  it("fehlen einem Schuss Abgabefolge und Zeit, folgen Reihenfolge und Nummern beide der Liste", () => {
    // Handeintrag ohne seq, Zeit und Wert vorn, dann zwölf Schuss mit seq 12 … 1: Die Karte lässt sich
    // nur nach der Liste ordnen; die Auswahl darf nicht nach seq umsortieren.
    const hand: MetricShot = { ...shot(0, 100), seq: null, firedAtMs: null, decimalTenths: null }
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      ...shot(i, 100 + (i % 3)),
      seq: 12 - i,
    }))
    const numbers = movingAverage([hand, ...twelve], "decimal", 10).map((p) => p.number)
    expect(numbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it("gleitender Schnitt in ganzen Ringen", () => {
    const values = Array.from({ length: 12 }, (_, i) => shot(i, 98 + i))
    const average = movingAverage(values, "rings", 10)
    expect(average[0]).toEqual({ number: 1, value: 9, meanRings: 9, partial: true })
    expect(average[9].meanRings).toBeCloseTo(9.8, 9)
    expect(average[11].meanRings).toBe(10)
  })

  it("längste Folge ab einer Schwelle, mit Start", () => {
    const values = [101, 102, 99, 100, 103, 104, 98].map((v, i) => shot(i, v))
    expect(longestRun(values, "decimal", 100)).toEqual({ length: 3, start: 4 })
    expect(longestRun(values, "decimal", 102)).toEqual({ length: 2, start: 5 })
    expect(longestRun(values, "decimal", 110)).toEqual({ length: 0, start: null })
  })

  it("ein Schuss ohne Wert unterbricht die Folge; der Start ist die Schussnummer", () => {
    const values = [101, 102, 103, 104, 105, 98]
      .map((v, i) => shot(i, v))
      .map((s, i) => (i === 1 ? { ...s, decimalTenths: null } : s))
    expect(longestRun(values, "decimal", 100)).toEqual({ length: 3, start: 3 })
  })

  it("längste Folge in ganzen Ringen: 10,1 und 10,2 sind beide eine 10", () => {
    const values = [101, 102, 99, 100, 103, 104, 98].map((v, i) => shot(i, v))
    expect(longestRun(values, "rings", 100)).toEqual({ length: 3, start: 4 })
    expect(longestRun(values, "rings", 102)).toEqual({ length: 0, start: null })
    expect(longestRun(values, "rings", 90)).toEqual({ length: 7, start: 1 })
  })
})
