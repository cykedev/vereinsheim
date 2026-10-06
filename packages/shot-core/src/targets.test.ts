import { describe, expect, it } from "vitest"

import { defineTarget, LG_10M, LP_10M, TARGETS, type TargetSpec } from "./targets"

// Maße aus der DSB-Sportordnung 2026, Teil 0, Anhang 0.20 (gleich ISSF 2026):
// Ø(n) = Ø10 + 2 · Ringabstand · (10 − n).
const ringDiameterMm = (radiiUm: readonly number[], ring: number) => (radiiUm[ring - 1] * 2) / 1000

describe("Scheibenbilder 10 m", () => {
  it("Luftgewehr: Ring 1 misst 45,5 mm, Ring 9 5,5 mm, der Zehner ist ein 0,5-mm-Punkt", () => {
    expect(ringDiameterMm(LG_10M.ringRadiiUm, 1)).toBe(45.5)
    expect(ringDiameterMm(LG_10M.ringRadiiUm, 9)).toBe(5.5)
    expect(ringDiameterMm(LG_10M.ringRadiiUm, 10)).toBe(0.5)
  })

  it("Luftpistole: Ring 1 misst 155,5 mm, Ring 9 27,5 mm, der Zehner 11,5 mm", () => {
    expect(ringDiameterMm(LP_10M.ringRadiiUm, 1)).toBe(155.5)
    expect(ringDiameterMm(LP_10M.ringRadiiUm, 9)).toBe(27.5)
    expect(ringDiameterMm(LP_10M.ringRadiiUm, 10)).toBe(11.5)
  })

  it("Zehnerradius plus halbes Kaliber ist genau ein Ringabstand (Kurzform 11 − d ÷ W)", () => {
    expect(LG_10M.scoringRadiusUm).toBe(LG_10M.ringWidthUm)
    expect(LP_10M.scoringRadiusUm).toBe(LP_10M.ringWidthUm)
  })

  it("Innenzehner: LP berührt den 5-mm-Ring (4,75 mm), LG schießt den Punkt ganz weg (2,0 mm)", () => {
    expect(LP_10M.innerTenMaxDistanceUm).toBe(4750)
    expect(LG_10M.innerTenMaxDistanceUm).toBe(2000)
  })

  it("der Spiegel endet auf einem Ring: LG ab Ring 4, LP ab Ring 7", () => {
    expect(LG_10M.blackFromRing).toBe(4)
    expect(LP_10M.blackFromRing).toBe(7)
  })

  it("TARGETS kennt genau die beiden 10-m-Scheiben und ist eingefroren", () => {
    expect(Object.keys(TARGETS).sort()).toEqual(["lg-10m", "lp-10m"])
    expect(Object.isFrozen(TARGETS)).toBe(true)
    expect(Object.isFrozen(LP_10M)).toBe(true)
    expect(Object.isFrozen(LP_10M.ringRadiiUm)).toBe(true)
  })
})

describe("defineTarget", () => {
  const base: TargetSpec = {
    id: "lp-10m",
    version: 1,
    label: "Testscheibe",
    weapon: "lp",
    tenDiameterMm: 11.5,
    ringWidthMm: 8,
    blackDiameterMm: 59.5,
    caliberMm: 4.5,
    innerTen: { kind: "touch", diameterMm: 5 },
    labelRings: [1, 2, 3, 4, 5, 6, 7, 8],
  }

  it("übernimmt eine gültige Scheibe", () => {
    expect(defineTarget(base).ringWidthUm).toBe(8000)
  })

  it("lehnt einen Ringabstand ab, dessen Zehntel kein ganzes µm ist", () => {
    expect(() => defineTarget({ ...base, ringWidthMm: 2.555 })).toThrow(RangeError)
  })

  it("lehnt einen Zehner ab, der kein ganzes µm ergibt", () => {
    expect(() => defineTarget({ ...base, tenDiameterMm: 0.0005 })).toThrow(RangeError)
  })

  it("lehnt einen Spiegel ab, der auf keinem Ring endet", () => {
    expect(() => defineTarget({ ...base, blackDiameterMm: 31 })).toThrow(RangeError)
  })
})
