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

  it("schräg gestreckte Gruppe quer versetzt: die Kovarianz zählt", () => {
    const slanted = [
      [-1520, -1308],
      [-1732, -1096],
      [-813, -601],
      [-1025, -389],
      [-106, 106],
      [-318, 318],
      [601, 813],
      [389, 1025],
      [1308, 1520],
      [1096, 1732],
    ].map(([x, y], i) => at(x, y, i))
    const result = mpiConfidence(slanted)
    // ohne Kovarianz wären es nur 0,8 (zufällig); kritisch 10,03
    expect(result?.t2).toBeCloseTo(36, 6)
    expect(result?.critical).toBeCloseTo(10.0327, 4)
    expect(result?.real).toBe(true)
  })

  it("zehn enge Schuss um (5 | 0) mm: echt", () => {
    expect(mpiConfidence(TIGHT_RIGHT)?.real).toBe(true)
    expect(mpiConfidence(SPREAD.slice(0, 2))).toBeNull()
  })

  it("alle Treffer auf einer Linie: kein Urteil, auch wenn die Rundung einen Rest lässt", () => {
    // exakt kollinear (Richtung 1000 | 1333), der Schwerpunkt ist aber nicht ganzzahlig
    const line = [
      [123, 456],
      [1123, 1789],
      [3123, 4455],
      [10123, 13786],
    ].map(([x, y], i) => at(x, y, i))
    expect(mpiConfidence(line)).toBeNull()
  })
})

describe("Ringverlust durch Lage gegen Streuung (L4)", () => {
  it("LP, eng um (5 | 0) mm: 10,3 statt 10,9, in ganzen Ringen kein Verlust", () => {
    const split = ringLossSplit(TIGHT_RIGHT, LP_10M)
    expect(split?.n).toBe(10)
    expect(split?.actual).toEqual({ decimal: 103, rings: 100 })
    expect(split?.centered).toEqual({ decimal: 109, rings: 100 })
    expect(split?.positionLoss.decimal).toBeCloseTo(6, 9)
    expect(split?.positionLoss.rings).toBe(0)
    expect(split?.spreadLoss.decimal).not.toBeNull()
    expect(split?.spreadLoss.decimal).toBeCloseTo(0, 9)
    expect(split?.spreadLoss.rings).toBe(0)
    expect(split?.reliable).toBe(true)
  })

  it("unter zehn Schuss oder ohne echte Lage nicht belastbar", () => {
    expect(ringLossSplit(TIGHT_RIGHT.slice(0, 9), LP_10M)?.reliable).toBe(false)
    const centered = OFFSETS.map(([dx, dy], i) => at(dx, dy, i))
    expect(ringLossSplit(centered, LP_10M)?.reliable).toBe(false)
    expect(ringLossSplit([], LP_10M)).toBeNull()
  })

  it("Gewinn durchs Zentrieren, aber Lage nicht echt: nicht belastbar", () => {
    // LP, zehn Schuss im Kreis von 6 mm um (1,5 | 0) mm: T² 1,1 unter 10,03. Ist 101,6, zentriert
    // 102,0 (alle 10,2), in ganzen Ringen beide Male 100.
    const wide = Array.from({ length: 10 }, (_, k) =>
      at(
        1500 + Math.round(6000 * Math.cos((k * Math.PI) / 5)),
        Math.round(6000 * Math.sin((k * Math.PI) / 5)),
        k
      )
    )
    expect(mpiConfidence(wide)?.real).toBe(false)
    const split = ringLossSplit(wide, LP_10M)
    expect(split?.actual.decimal).toBeCloseTo(101.6, 9)
    expect(split?.centered.decimal).toBeCloseTo(102, 9)
    expect(split?.positionLoss.rings).toBe(0)
    expect(split?.reliable).toBe(false)
  })

  it("schiefe Gruppe: Verschieben um den Schwerpunkt kostet Zehntel, dann nicht belastbar", () => {
    // LP: 20 Schuss in der Mitte (10,9), 10 bei 9 mm rechts (9,8); Schwerpunkt (3 | 0) mm, echt.
    // Zentriert: 20 × 10,6 und 10 × 10,2 = 314,0 statt 316,0; in ganzen Ringen 300 statt 290.
    const skewed = Array.from({ length: 30 }, (_, i) =>
      at(i < 20 ? 0 : 9000, i % 2 === 0 ? 200 : -200, i)
    )
    expect(mpiConfidence(skewed)?.real).toBe(true)
    const split = ringLossSplit(skewed, LP_10M)
    expect(split?.actual).toEqual({ decimal: 316, rings: 290 })
    expect(split?.centered).toEqual({ decimal: 314, rings: 300 })
    expect(split?.positionLoss.decimal).toBeCloseTo(-2, 9)
    expect(split?.positionLoss.rings).toBe(10)
    expect(split?.reliable).toBe(false)
  })
})

describe("Lageanteil, Richtungsuhr und Drift (L5, L6, L8)", () => {
  it("Lageanteil: 0 bei zentrierter Gruppe, fast alles bei enger versetzter", () => {
    const share = positionShare(SPREAD)
    expect(share).not.toBeNull()
    expect(share).toBeCloseTo(0, 9)
    // ab drei Schuss
    expect(positionShare(SPREAD.slice(0, 3))).not.toBeNull()
    expect(positionShare(SPREAD.slice(0, 2))).toBeNull()
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

  it("Richtungsuhr: aussagekräftig erst ab 30 Schuss (L6)", () => {
    expect(directionClock(SPREAD).reliable).toBe(false)
    const thirty = Array.from({ length: 30 }, (_, i) => at(1000 + i, 500 - i, i))
    expect(directionClock(thirty).reliable).toBe(true)
  })

  it("Drift: Sprünge und von-Neumann-Verhältnis in Abgabefolge", () => {
    const result = drift(SPREAD)
    expect(result?.vonNeumann).toBeCloseTo(1.6, 9)
    expect(result?.meanJumpUm).toBeCloseTo((5000 + 2000 + Math.sqrt(18e6) + 4000 + 1000) / 5, 6)
    expect(result?.maxJumpUm).toBe(5000)
  })

  it("Drift mit Lücke: der Sprung über die Lücke fehlt, das Verhältnis bleibt je Sprung normiert", () => {
    // seq 1, 2, 3, 5, 6, 7: der Sprung von Schuss 3 zu 4 (18 mm²) zählt nicht.
    // (Σ Sprung² / 4) / (Σ r² / 5) = (46 / 4) / (40 / 5) = 1,4375; ohne Normierung wären es 1,15.
    const gapped = SPREAD.map((shot, i) => ({ ...shot, seq: i < 3 ? i + 1 : i + 2 }))
    const result = drift(gapped)
    expect(result?.vonNeumann).toBeCloseTo(1.4375, 9)
    expect(result?.meanJumpUm).toBeCloseTo(3000, 6)
    expect(result?.maxJumpUm).toBe(5000)
  })
})
