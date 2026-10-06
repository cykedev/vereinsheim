import { describe, expect, it } from "vitest"

import { MATCH, PROBE, SPREAD } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
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
    expect(heightWidth(SPREAD.slice(0, 1))).toBeNull()
  })

  it("Form: Halbachsen, Verhältnis, Winkel; den Winkel erst ab zehn Schuss zeigen", () => {
    const shape = groupShape(SPREAD)
    expect(shape?.majorUm).toBeCloseTo(Math.sqrt(5.2e6), 6)
    expect(shape?.minorUm).toBeCloseTo(Math.sqrt(2.8e6), 6)
    expect(shape?.ratio).toBeCloseTo(Math.sqrt(5.2 / 2.8), 9)
    expect(shape?.angleRad).toBeCloseTo(0, 9)
    expect(shape?.showAngle).toBe(false)
    const stretched = Array.from({ length: 10 }, (_, i) => ({
      ...SPREAD[0],
      xUm: (i - 4.5) * 1000,
      yUm: i % 2 === 0 ? 300 : -300,
    }))
    expect(groupShape(stretched)?.showAngle).toBe(true)
  })

  it("Streuung in Ringbreiten", () => {
    expect(ringWidths(14000 / 6, LG_10M)).toBeCloseTo(14000 / 6 / 2500, 9)
  })
})

describe("Ausreißer (V6, V7)", () => {
  it("SPREAD hat keine; MR/R50 wie gerechnet", () => {
    const result = outliers(SPREAD)
    expect(result?.indices).toEqual([])
    expect(result?.ratio).toBeCloseTo(14 / 6 / 2.5, 9)
  })

  it("ein weiter Schuss fällt auf", () => {
    const far: MetricShot = { ...PROBE[0], xUm: 9000, yUm: 9000 }
    expect(outliers([...PROBE, far])?.indices).toEqual([5])
    expect(outliers(PROBE.slice(0, 4))).toBeNull()
  })

  it("ein mäßiger Ausreißer fällt auf, die Gruppe mit verschiedenen Radien nicht", () => {
    const base = [
      [800, 0],
      [-800, 0],
      [0, 1000],
      [0, -1000],
      [1100, 0],
      [-1100, 0],
      [0, 1300],
      [0, -1300],
      [900, 900],
      [-900, -900],
    ].map(([xUm, yUm]) => ({ ...PROBE[0], xUm, yUm }))
    expect(outliers(base)?.indices).toEqual([])
    // 2,6 mm: über Q3 + 1,5 · IQR (1,78 mm), aber kein extremer Treffer
    expect(outliers([...base, { ...PROBE[0], xUm: 2600, yUm: 0 }])?.indices).toEqual([10])
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
})
