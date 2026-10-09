import { describe, expect, it } from "vitest"

import { BOUNDARY_DISTANCES, EVENING_SHOTS } from "./__fixtures__/meyton-2026-10-09"
import {
  distanceUm,
  MEYTON_TOLERANCE_UM,
  scoreFromCoordinates,
  scoreFromDistance,
  teilerFromDistanceUm,
} from "./scoring"
import { LG_10M, LP_10M, MAX_DECIMAL_TENTHS, TARGETS, type TargetImage } from "./targets"

// Abstände in µm, Werte in Zehnteln (94 = 9,4) wie in der SSMDB2.

describe("Ausdruck vom 2. Oktober 2026 (Luftpistole, Abstand aus dem Teiler)", () => {
  it.each([
    [3318, 105, true], // Schuss 8, Teiler 331,8, Stern
    [3964, 105, true], // Schuss 2, Teiler 396,4, Stern
    [5474, 103, false], // Schuss 15, Teiler 547,4
    [26560, 76, false], // Schuss 23, Teiler 2656
    [33690, 67, false], // Schuss 5, Teiler 3369
    [38310, 62, false], // Schuss 27, Teiler 3831
  ])("%i µm → %i Zehntel, Innenzehner %s", (d, tenths, innerTen) => {
    const score = scoreFromDistance(LP_10M, d)
    expect(score.decimalTenths).toBe(tenths)
    expect(score.innerTen).toBe(innerTen)
  })
})

describe("ShotsApp-Screenshots (Luftpistole, Serie 1)", () => {
  it.each([
    [12643, 94],
    [11823, 95],
    [18561, 86],
  ])("%i µm → %i Zehntel", (d, tenths) => {
    expect(scoreFromDistance(LP_10M, d).decimalTenths).toBe(tenths)
  })
})

describe("Abend vom 9. Oktober 2026 (Meyton-Toleranz, SF-75)", () => {
  it("jeder der 40 Schüsse wie Meyton, aus der Lage wie aus dem Teiler", () => {
    for (const shot of EVENING_SHOTS) {
      const expected = { decimalTenths: shot.decimalTenths, innerTen: shot.innerTen }
      expect(scoreFromCoordinates(LP_10M, shot.xUm, shot.yUm), `Schuss ${shot.nr}`).toMatchObject(
        expected
      )
      expect(scoreFromDistance(LP_10M, shot.distanceUm), `Schuss ${shot.nr}`).toMatchObject(
        expected
      )
    }
    expect(EVENING_SHOTS.reduce((sum, shot) => sum + shot.decimalTenths, 0)).toBe(3564)
  })

  it("die Grenzabstände legen die Toleranz auf 10 µm fest", () => {
    for (const { target, um, tenths } of BOUNDARY_DISTANCES) {
      expect(scoreFromDistance(TARGETS[target], um).decimalTenths, `${target} ${um} µm`).toBe(
        tenths
      )
    }
  })
})

describe("Grenzen (Meyton: bis knapp 10 µm hinter der Regelgrenze zählt der höhere Wert)", () => {
  it("auf und bis knapp 10 µm hinter der Grenze der höhere Wert, auch wo die naive Formel scheitert", () => {
    // Die Formel des Prototyps rechnet hier mit Gleitkomma und landet einen Zehntel zu tief.
    expect(Math.floor((11 - 63200 / 8000) * 10)).toBe(30)
    expect(scoreFromDistance(LP_10M, 63200).decimalTenths).toBe(31)
    expect(scoreFromDistance(LP_10M, 63209.99).decimalTenths).toBe(31)
    expect(scoreFromDistance(LP_10M, 63210).decimalTenths).toBe(30)
    expect(scoreFromDistance(LG_10M, 19750).decimalTenths).toBe(31)
    expect(scoreFromDistance(LG_10M, 19759).decimalTenths).toBe(31)
    expect(scoreFromDistance(LG_10M, 19760).decimalTenths).toBe(30)
  })

  it("höchstens 10,9", () => {
    for (const [target, edge] of [
      [LP_10M, 800],
      [LG_10M, 250],
    ] as const) {
      expect(scoreFromDistance(target, 0).decimalTenths).toBe(MAX_DECIMAL_TENTHS)
      expect(scoreFromDistance(target, edge + 9).decimalTenths).toBe(MAX_DECIMAL_TENTHS)
      expect(scoreFromDistance(target, edge + 10).decimalTenths).toBe(108)
    }
  })

  it("Innenzehner der Luftpistole: berührt den 5-mm-Ring bis 4,75 mm, bei Meyton bis knapp 4,76 mm", () => {
    expect(scoreFromDistance(LP_10M, 4759)).toMatchObject({ decimalTenths: 104, innerTen: true })
    expect(scoreFromDistance(LP_10M, 4760)).toMatchObject({ decimalTenths: 104, innerTen: false })
  })

  it("Innenzehner des Luftgewehrs: der Punkt ist ganz weg bis 2,0 mm (Meyton knapp 2,01 mm), also ab 10,2", () => {
    expect(scoreFromDistance(LG_10M, 2009)).toMatchObject({ decimalTenths: 102, innerTen: true })
    expect(scoreFromDistance(LG_10M, 2010)).toMatchObject({ decimalTenths: 101, innerTen: false })
  })

  it("unter 1,0 ist ein Fehlschuss: Ring 0, Zehntel 0", () => {
    for (const [target, limit] of [
      [LP_10M, 80000],
      [LG_10M, 25000],
    ] as const) {
      expect(scoreFromDistance(target, limit + 9)).toEqual({
        decimalTenths: 10,
        ring: 1,
        innerTen: false,
        miss: false,
      })
      expect(scoreFromDistance(target, limit + 10)).toEqual({
        decimalTenths: 0,
        ring: 0,
        innerTen: false,
        miss: true,
      })
    }
  })

  it("der ganze Ring folgt der Berührungsregel, um Meytons Toleranz verschoben", () => {
    const ring = (d: number) => scoreFromDistance(LP_10M, d).ring
    expect(ring(8009)).toBe(10)
    expect(ring(8010)).toBe(9)
    expect(ring(16009)).toBe(9)
    expect(ring(16010)).toBe(8)
  })
})

describe("Wertung aus Koordinaten", () => {
  it("rechnet exakt mit ganzen µm", () => {
    // 960² + 1280² = 1600²: genau auf der Regelgrenze zu 10,8; Meyton zählt bis knapp 1610 µm.
    expect(scoreFromCoordinates(LP_10M, 960, 1280).decimalTenths).toBe(108)
    expect(scoreFromDistance(LP_10M, 1600).decimalTenths).toBe(108)
    expect(scoreFromCoordinates(LP_10M, 0, 1609).decimalTenths).toBe(108)
    expect(scoreFromCoordinates(LP_10M, 0, 1610).decimalTenths).toBe(107)
  })

  it("Vorzeichen und Achsen spielen keine Rolle", () => {
    const expected = scoreFromCoordinates(LP_10M, 1234, -5678)
    expect(scoreFromCoordinates(LP_10M, -1234, -5678)).toEqual(expected)
    expect(scoreFromCoordinates(LP_10M, 1234, 5678)).toEqual(expected)
    expect(scoreFromCoordinates(LP_10M, -5678, 1234)).toEqual(expected)
  })

  it("absurde Abstände enden als Fehlschuss statt in einer Endlosschleife", () => {
    expect(scoreFromDistance(LP_10M, 1e300).miss).toBe(true)
    expect(scoreFromDistance(LP_10M, Number.MAX_VALUE).miss).toBe(true)
  })

  it("lehnt Koordinaten jenseits sicherer Ganzzahlen ab", () => {
    expect(() => scoreFromCoordinates(LP_10M, 1e200, 0)).toThrow(RangeError)
  })

  it("lehnt ungültige Eingaben ab", () => {
    expect(() => scoreFromCoordinates(LP_10M, 0.5, 0)).toThrow(RangeError)
    expect(() => scoreFromDistance(LP_10M, -1)).toThrow(RangeError)
    expect(() => scoreFromDistance(LP_10M, Number.NaN)).toThrow(RangeError)
  })
})

describe("Eigenschaften über den ganzen Abstand", () => {
  const missLimit = (target: TargetImage) => target.scoringRadiusUm + 9 * target.ringWidthUm

  it.each([
    ["Luftpistole", LP_10M],
    ["Luftgewehr", LG_10M],
  ] as const)(
    "%s: nie steigend, Ring = abgeschnittene Zehntel, Fehlschuss nur jenseits",
    (_, t) => {
      let previous = Number.POSITIVE_INFINITY
      for (let d = 0; d <= 90000; d += 7) {
        const score = scoreFromDistance(t, d)
        expect(score.decimalTenths).toBeLessThanOrEqual(previous)
        expect(score.ring).toBe(Math.floor(score.decimalTenths / 10))
        expect(score.miss).toBe(d >= missLimit(t) + MEYTON_TOLERANCE_UM)
        expect(scoreFromCoordinates(t, 0, d)).toEqual(score)
        previous = score.decimalTenths
      }
    }
  )
})

describe("Abstand und Teiler", () => {
  it("der Teiler ist der Abstand in 1/100 mm", () => {
    expect(teilerFromDistanceUm(3318)).toBe(331.8)
    expect(distanceUm(3000, 4000)).toBe(5000)
  })
})
