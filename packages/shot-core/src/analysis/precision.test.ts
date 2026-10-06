import { describe, expect, it } from "vitest"

import { MATCH, PROBE, SPREAD } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { LG_10M } from "../targets"
import {
  groupShape,
  heightWidth,
  outlierLoss,
  outliers,
  ringWidths,
  sigmaEstimate,
} from "./precision"

describe("Rayleigh-σ (P5)", () => {
  it("Sa, σ̂ mit c4 und 95-%-Bereich über χ²", () => {
    // SPREAD: Σr² = 40 mm², 2(n − 1) = 10 Freiheitsgrade.
    const sigma = sigmaEstimate(SPREAD)
    expect(sigma?.n).toBe(6)
    expect(sigma?.sa).toBeCloseTo(2000, 6)
    expect(sigma?.sigma).toBeCloseTo(2050.5458, 3)
    expect(sigma?.low).toBeCloseTo(1397.4341, 3)
    expect(sigma?.high).toBeCloseTo(3509.8671, 3)
  })

  it("unter drei Schuss kein Wert; verdächtige Schüsse zählen nicht (SF-15)", () => {
    expect(sigmaEstimate(SPREAD.slice(0, 2))).toBeNull()
    const placeholder: MetricShot = { ...SPREAD[0], xUm: 0, yUm: 0, flags: ["verdaechtig"] }
    expect(sigmaEstimate([...SPREAD, placeholder])?.n).toBe(6)
  })
})

describe("Höhe, Breite und Form (P7, P8, P9)", () => {
  it("Höhe, Breite und ihr Mittel", () => {
    expect(heightWidth(SPREAD)).toEqual({ n: 6, height: 5000, width: 7000, figureOfMerit: 6000 })
    // ab drei Schuss wie group.height und group.width (SF-61)
    expect(heightWidth(SPREAD.slice(0, 2))).toBeNull()
    expect(heightWidth(SPREAD.slice(0, 3))).not.toBeNull()
  })

  it("Form: Halbachsen, Verhältnis, Winkel; den Winkel erst ab zehn Schuss zeigen", () => {
    const shape = groupShape(SPREAD)
    expect(shape?.majorUm).toBeCloseTo(Math.sqrt(5.2e6), 6)
    expect(shape?.minorUm).toBeCloseTo(Math.sqrt(2.8e6), 6)
    expect(shape?.ratio).toBeCloseTo(Math.sqrt(5.2 / 2.8), 9)
    expect(shape?.angleRad).toBeCloseTo(0, 9)
    // Mauchly: W = 4 · 5,2 · 2,8 / 8² = 0,91, Grenze bei n = 6: 0,05^(1/2) = 0,2236
    expect(shape?.sphericity).toBeCloseTo(0.91, 9)
    expect(shape?.elongated).toBe(false)
    expect(shape?.showAngle).toBe(false)
    const stretched = Array.from({ length: 10 }, (_, i) => ({
      ...SPREAD[0],
      xUm: (i - 4.5) * 1000,
      yUm: i % 2 === 0 ? 300 : -300,
    }))
    expect(groupShape(stretched)?.showAngle).toBe(true)
  })

  it("gestreckt nur, wenn Mauchly es mit 95 % zeigt, nicht schon ab a/b 1,3", () => {
    const ellipse = (a: number, b: number) =>
      Array.from({ length: 12 }, (_, k) => ({
        ...SPREAD[0],
        xUm: Math.round(a * Math.cos((k * Math.PI) / 6)),
        yUm: Math.round(b * Math.sin((k * Math.PI) / 6)),
      }))
    // a/b = 3: W = 4 · 9 · 1 / 10² = 0,36 unter der Grenze 0,05^(2/10) = 0,5493
    const long = groupShape(ellipse(3000, 1000))
    expect(long?.sphericity).toBeCloseTo(0.36, 6)
    expect(long?.elongated).toBe(true)
    expect(long?.showAngle).toBe(true)
    // a/b = 1,4: W = 0,8949, rund im Rahmen des Zufalls, obwohl a/b über 1,3 liegt
    const round = groupShape(ellipse(1400, 1000))
    expect(round?.sphericity).toBeCloseTo(0.8949, 4)
    expect(round?.elongated).toBe(false)
    expect(round?.showAngle).toBe(false)
  })

  it("gestreckt, aber unter zehn Schuss: kein Winkel", () => {
    // acht Schuss, a/b = 6: W = 4 · 36 / 37² = 0,105 unter der Grenze 0,05^(1/3) = 0,368
    const eight = Array.from({ length: 8 }, (_, k) => ({
      ...SPREAD[0],
      xUm: Math.round(3000 * Math.cos((k * Math.PI) / 4)),
      yUm: Math.round(500 * Math.sin((k * Math.PI) / 4)),
    }))
    const shape = groupShape(eight)
    expect(shape?.elongated).toBe(true)
    expect(shape?.showAngle).toBe(false)
  })

  it("die Mauchly-Grenze ist 0,05^(2/(n − 2)), nicht strenger und nicht weiter", () => {
    const ellipse = (a: number, b: number) =>
      Array.from({ length: 12 }, (_, k) => ({
        ...SPREAD[0],
        xUm: Math.round(a * Math.cos((k * Math.PI) / 6)),
        yUm: Math.round(b * Math.sin((k * Math.PI) / 6)),
      }))
    // W = 0,565 knapp über der Grenze 0,5493 (mit 2/(n − 1) läge sie bei 0,5806)
    expect(groupShape(ellipse(2208, 1000))?.elongated).toBe(false)
    // W = 0,449 unter der Grenze (mit α = 0,01 läge sie bei 0,398)
    expect(groupShape(ellipse(2600, 1000))?.elongated).toBe(true)
  })

  it("auf einer Linie maximal gestreckt; ohne Ausdehnung keine Form", () => {
    const line = Array.from({ length: 10 }, (_, i) => ({
      ...SPREAD[0],
      xUm: i * 100,
      yUm: i * 100,
    }))
    const shape = groupShape(line)
    expect(shape?.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(shape?.sphericity).toBe(0)
    expect(shape?.showAngle).toBe(true)
    const same = Array.from({ length: 10 }, () => ({ ...SPREAD[0], xUm: 500, yUm: -500 }))
    expect(groupShape(same)).toBeNull()
  })

  it("Streuung in Ringbreiten", () => {
    expect(ringWidths(14000 / 6, LG_10M)).toBeCloseTo(14000 / 6 / 2500, 9)
  })
})

describe("Ausreißer (V6, V7)", () => {
  // Acht Schuss im Kreis von 1 mm um die Mitte, dazu ein Testschuss auf der x-Achse. Gegen die übrigen
  // acht: S² = Σr²/14, T = D² / (2 S² · 9/8), Grenze F(2, 14) beim Quantil 1 − 0,05/9 = 7,6987.
  const ring8 = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => ({
    ...MATCH[0],
    xUm: Math.round(1000 * Math.cos((deg * Math.PI) / 180)),
    yUm: Math.round(1000 * Math.sin((deg * Math.PI) / 180)),
    firedAtMs: i * 1000,
  }))
  const withTest = (d: number) => [...ring8, { ...MATCH[0], xUm: d, yUm: 0, firedAtMs: 9000 }]

  it("SPREAD hat keine; MR/R50 wie gerechnet", () => {
    const result = outliers(SPREAD)
    expect(result?.flagged).toEqual([])
    expect(result?.ratio).toBeCloseTo(14 / 6 / 2.5, 9)
  })

  it("jeder gegen die übrigen mit F(2, 2(n − 2)) und Bonferroni", () => {
    // 2,8 mm: T 6,10; ohne Bonferroni (Grenze 3,74) wäre es ein Ausreißer
    expect(outliers(withTest(2800))?.flagged).toEqual([])
    // 3,05 mm: T 7,24 knapp unter der Grenze; ohne (1 + 1/(n − 1)) oder mit 2(n − 1) wäre er drüber
    expect(outliers(withTest(3050))?.flagged).toEqual([])
    // 3,3 mm: T 8,47 über der Grenze, und nur er
    const result = outliers(withTest(3300))
    expect(result?.flagged.map((f) => f.number)).toEqual([9])
    expect(result?.flagged[0].shot.xUm).toBe(3300)
  })

  it("die Grenze nutzt 2(n − 2) Freiheitsgrade", () => {
    // 3,1 mm: T 7,48 unter der Grenze 7,70; mit 2(n − 1) Freiheitsgraden läge sie bei 7,31
    expect(outliers(withTest(3100))?.flagged).toEqual([])
  })

  it("sind die übrigen alle an einer Stelle, ist jeder Abstand auffällig", () => {
    const same = Array.from({ length: 4 }, (_, i) => ({
      ...MATCH[0],
      xUm: 0,
      yUm: 0,
      firedAtMs: i * 1000,
    }))
    const card = [...same, { ...MATCH[0], xUm: 1000, yUm: 0, firedAtMs: 9000 }]
    expect(outliers(card)?.flagged.map((f) => f.number)).toEqual([5])
  })

  it("die Nummer zählt alle Schüsse der Art, auch Platzhalter ohne Lage", () => {
    const placeholder: MetricShot = {
      ...MATCH[0],
      xUm: null,
      yUm: null,
      firedAtMs: 500,
      flags: [FLAG_SUSPICIOUS],
    }
    // der Platzhalter ist Schuss 2, der Testschuss damit Schuss 10
    expect(outliers([...withTest(3300), placeholder])?.flagged.map((f) => f.number)).toEqual([10])
  })

  it("ein weiter Schuss fällt auf; unter fünf Schuss kein Urteil", () => {
    const far: MetricShot = { ...PROBE[0], xUm: 9000, yUm: 9000, firedAtMs: 300_000 }
    expect(outliers([...PROBE, far])?.flagged.map((f) => f.number)).toEqual([6])
    expect(outliers(PROBE.slice(0, 4))).toBeNull()
  })

  it("Ringverlust durch die schwächsten 10 %", () => {
    const values = [105, 104, 103, 105, 104, 103, 105, 104, 103, 60]
    const shots = values.map((decimalTenths, i) => ({
      ...MATCH[0],
      decimalTenths,
      ring: Math.floor(decimalTenths / 10),
      firedAtMs: i * 1000,
    }))
    expect(outlierLoss(shots, "decimal")).toEqual({ n: 10, count: 1, loss: 4.4 })
    expect(outlierLoss(shots, "rings")).toEqual({ n: 10, count: 1, loss: 4 })
    expect(outlierLoss(shots.slice(0, 9), "decimal")).toBeNull()
  })

  it("10 % gerundet: bei 15 Schuss die schwächsten zwei", () => {
    const values = [...Array.from({ length: 13 }, () => 105), 80, 60]
    const shots = values.map((decimalTenths, i) => ({
      ...MATCH[0],
      decimalTenths,
      ring: Math.floor(decimalTenths / 10),
      firedAtMs: i * 1000,
    }))
    // Median 10,5; (10,5 − 6,0) + (10,5 − 8,0) = 7,0
    expect(outlierLoss(shots, "decimal")).toEqual({ n: 15, count: 2, loss: 7 })
  })
})
