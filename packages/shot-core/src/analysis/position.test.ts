import { describe, expect, it } from "vitest"

import { MATCH, SPREAD } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
import { LP_10M } from "../targets"
import { directionClock, drift, mpiConfidence, positionShare, ringLossSplit } from "./position"

const at = (xUm: number, yUm: number, i: number): MetricShot => ({
  ...MATCH[0],
  xUm,
  yUm,
  firedAtMs: i * 10_000,
})

// Zehn Schuss eng um (5 | 0) mm, Schwerpunkt genau dort.
const OFFSETS = [
  [0, 0],
  [100, 0],
  [-100, 0],
  [0, 100],
  [0, -100],
  [100, 100],
  [-100, -100],
  [100, -100],
  [-100, 100],
  [0, 0],
]
const TIGHT_RIGHT = OFFSETS.map(([dx, dy], i) => at(5000 + dx, dy, i))

describe("Ist die Lage echt? (L3, Hotelling-T²)", () => {
  it("Schwerpunkt in der Mitte: T² 0, nicht echt", () => {
    const result = mpiConfidence(SPREAD)
    expect(result?.t2).toBeCloseTo(0, 9)
    expect(result?.real).toBe(false)
    // n = 6: kritischer Wert 2·5/4 · F₀,₉₅(2; 4) = 17,3607
    expect(result?.critical).toBeCloseTo(17.3607, 4)
    expect(result?.ellipse.majorUm).toBeCloseTo(Math.sqrt((5.2e6 * 17.36068) / 6), 0)
  })

  it("vier Schuss um (2 | 0) mm: T² 24 unter dem kritischen Wert 57", () => {
    const four = [at(3000, 0, 0), at(1000, 0, 1), at(2000, 1000, 2), at(2000, -1000, 3)]
    const result = mpiConfidence(four)
    expect(result?.t2).toBeCloseTo(24, 9)
    expect(result?.critical).toBeCloseTo(57, 9)
    expect(result?.real).toBe(false)
  })

  it("zehn enge Schuss um (5 | 0) mm: echt", () => {
    expect(mpiConfidence(TIGHT_RIGHT)?.real).toBe(true)
    expect(mpiConfidence(SPREAD.slice(0, 2))).toBeNull()
  })
})

describe("Ringverlust durch Lage gegen Streuung (L4)", () => {
  it("LP, eng um (5 | 0) mm: 10,3 statt 10,9, in ganzen Ringen kein Verlust", () => {
    const split = ringLossSplit(TIGHT_RIGHT, LP_10M)
    expect(split?.n).toBe(10)
    expect(split?.actual).toEqual({ tenths: 103, rings: 100 })
    expect(split?.centered).toEqual({ tenths: 109, rings: 100 })
    expect(split?.positionLoss.tenths).toBeCloseTo(6, 9)
    expect(split?.positionLoss.rings).toBe(0)
    expect(split?.spreadLoss.tenths).toBeCloseTo(0, 9)
    expect(split?.spreadLoss.rings).toBe(0)
    expect(split?.reliable).toBe(true)
  })

  it("unter zehn Schuss nicht belastbar", () => {
    expect(ringLossSplit(TIGHT_RIGHT.slice(0, 9), LP_10M)?.reliable).toBe(false)
    expect(ringLossSplit([], LP_10M)).toBeNull()
  })
})

describe("Lageanteil, Richtungsuhr und Drift (L5, L6, L8)", () => {
  it("Lageanteil: 0 bei zentrierter Gruppe, fast alles bei enger versetzter", () => {
    expect(positionShare(SPREAD)).toBeCloseTo(0, 9)
    expect(positionShare(TIGHT_RIGHT)).toBeCloseTo((25e6 - 120000 / 9 / 10) / 25_012_000, 9)
  })

  it("Richtungsuhr: 12 oben, 3 rechts, im Uhrzeigersinn", () => {
    const clock = directionClock(SPREAD)
    expect(clock.n).toBe(6)
    expect(clock.counts).toEqual([1, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0])
    expect(directionClock([at(1000, 1000, 0), at(-1000, -1000, 1)]).counts[1]).toBe(0)
    // um den Schwerpunkt statt um die Mitte
    expect(directionClock(TIGHT_RIGHT, { xUm: 5000, yUm: 0 }).n).toBe(8)
  })

  it("Drift: Sprünge und von-Neumann-Verhältnis in Abgabefolge", () => {
    const result = drift(SPREAD)
    expect(result?.vonNeumann).toBeCloseTo(1.6, 9)
    expect(result?.meanJumpUm).toBeCloseTo((5000 + 2000 + Math.sqrt(18e6) + 4000 + 1000) / 5, 6)
    expect(result?.maxJumpUm).toBe(5000)
  })
})
