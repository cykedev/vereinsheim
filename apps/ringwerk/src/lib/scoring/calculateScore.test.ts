import { describe, it, expect } from "vitest"
import {
  calculateCorrectedTeiler,
  calculateRingteiler,
  calculateScore,
  effectiveTeilerFaktor,
} from "./calculateScore"

describe("calculateCorrectedTeiler", () => {
  it("Faktor 1.0 lässt Teiler unverändert", () => {
    expect(calculateCorrectedTeiler(20, 1.0)).toBeCloseTo(20)
  })
  it("Faktor 0.3333333 (Luftpistole 1/3)", () => {
    expect(calculateCorrectedTeiler(60, 0.3333333)).toBeCloseTo(20.0)
  })
  it("Faktor 1.8 (LG Auflage)", () => {
    expect(calculateCorrectedTeiler(10, 1.8)).toBeCloseTo(18)
  })
})

describe("calculateRingteiler", () => {
  it("Ganzringe: 100 − 96 + 3.7 × 1.0 = 7.7", () => {
    expect(calculateRingteiler(96, 3.7, 1.0, 100)).toBeCloseTo(7.7)
  })
  it("Ganzringe: 100 − 96 + 4.2 × 1.0 = 8.2", () => {
    expect(calculateRingteiler(96, 4.2, 1.0, 100)).toBeCloseTo(8.2)
  })
  it("Zehntelringe: 109 − 104.5 + 2.1 × 1.0 = 6.6", () => {
    expect(calculateRingteiler(104.5, 2.1, 1.0, 109)).toBeCloseTo(6.6)
  })
  it("Faktor 0.3333333 (Luftpistole 1/3): 100 − 90 + 60 × 1/3 ≈ 30.0", () => {
    expect(calculateRingteiler(90, 60, 0.3333333, 100)).toBe(30.0)
  })
  it("Präzisionstest: 60.2 × 0.3333333 rundet korrekt auf 20.1", () => {
    expect(calculateRingteiler(90, 60.2, 0.3333333, 100)).toBe(30.1)
  })
  it("niedrigerer Ringteiler bei besserem Schützen", () => {
    const a = calculateRingteiler(96, 3.7, 1.0, 100)
    const b = calculateRingteiler(96, 4.2, 1.0, 100)
    expect(a).toBeLessThan(b)
  })
})

describe("calculateScore – RINGTEILER", () => {
  it("berechnet Ringteiler korrekt (Faktor 1.0)", () => {
    expect(
      calculateScore("RINGTEILER", { rings: 96, teiler: 3.7, faktor: 1.0, maxRings: 100 })
    ).toBeCloseTo(7.7)
  })
  it("wendet teilerFaktor an (Luftpistole 0.3333333)", () => {
    // 100 − 90 + 60 × 1/3 ≈ 30.0
    expect(
      calculateScore("RINGTEILER", { rings: 90, teiler: 60, faktor: 0.3333333, maxRings: 100 })
    ).toBe(30.0)
  })
  it("Zehntelringe mit Faktor", () => {
    expect(
      calculateScore("RINGTEILER", { rings: 104.5, teiler: 2.1, faktor: 1.0, maxRings: 109 })
    ).toBeCloseTo(6.6)
  })
})

describe("calculateScore – RINGS", () => {
  it("gibt Gesamtringe zurück", () => {
    expect(calculateScore("RINGS", { rings: 95, teiler: 5, faktor: 1, maxRings: 100 })).toBe(95)
  })
  it("Faktor hat keinen Einfluss", () => {
    const a = calculateScore("RINGS", { rings: 95, teiler: 5, faktor: 1.0, maxRings: 100 })
    const b = calculateScore("RINGS", { rings: 95, teiler: 5, faktor: 0.3333333, maxRings: 100 })
    expect(a).toBe(b)
  })
})

describe("calculateScore – RINGS_DECIMAL", () => {
  it("gibt Gesamtringe (Dezimal) zurück", () => {
    expect(
      calculateScore("RINGS_DECIMAL", { rings: 104.5, teiler: 2, faktor: 1, maxRings: 109 })
    ).toBe(104.5)
  })
})

describe("calculateScore – TEILER", () => {
  it("gibt korrigierten Teiler zurück (Faktor 1.0)", () => {
    expect(
      calculateScore("TEILER", { rings: 90, teiler: 20, faktor: 1.0, maxRings: 100 })
    ).toBeCloseTo(20)
  })
  it("wendet teilerFaktor an (LP 0.3333333): 60 × 1/3 ≈ 20.0", () => {
    expect(
      calculateScore("TEILER", { rings: 90, teiler: 60, faktor: 0.3333333, maxRings: 100 })
    ).toBeCloseTo(20.0)
  })
})

describe("calculateScore – DECIMAL_REST", () => {
  it("summiert Nachkommastellen: 9.5 + 10.2 + 8.7 → 1.4", () => {
    expect(
      calculateScore("DECIMAL_REST", {
        rings: 28.4,
        teiler: 5,
        faktor: 1,
        maxRings: 109,
        shots: [9.5, 10.2, 8.7],
      })
    ).toBeCloseTo(1.4)
  })
  it("leere Schüsse → 0", () => {
    expect(
      calculateScore("DECIMAL_REST", { rings: 0, teiler: 0, faktor: 1, maxRings: 109, shots: [] })
    ).toBe(0)
  })
  it("ganze Zahlen ergeben 0 Nachkommastelle", () => {
    expect(
      calculateScore("DECIMAL_REST", {
        rings: 27,
        teiler: 5,
        faktor: 1,
        maxRings: 100,
        shots: [10, 9, 8],
      })
    ).toBeCloseTo(0)
  })
})

describe("calculateScore – TARGET_ABSOLUTE", () => {
  it("Abweichung nach oben: |105 − 100| = 5", () => {
    expect(
      calculateScore("TARGET_ABSOLUTE", {
        rings: 0,
        teiler: 0,
        faktor: 1,
        maxRings: 100,
        measuredValue: 105,
        targetValue: 100,
      })
    ).toBe(5)
  })
  it("Abweichung nach unten: |95 − 100| = 5", () => {
    expect(
      calculateScore("TARGET_ABSOLUTE", {
        rings: 0,
        teiler: 0,
        faktor: 1,
        maxRings: 100,
        measuredValue: 95,
        targetValue: 100,
      })
    ).toBe(5)
  })
  it("exakt auf Zielwert → 0", () => {
    expect(
      calculateScore("TARGET_ABSOLUTE", {
        rings: 0,
        teiler: 0,
        faktor: 1,
        maxRings: 100,
        measuredValue: 100,
        targetValue: 100,
      })
    ).toBe(0)
  })
})

describe("calculateScore – TARGET_OVER", () => {
  it("Über-Zielwert: Abweichung direkt (105 bei Ziel 100 → 5)", () => {
    const score = calculateScore("TARGET_OVER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 105,
      targetValue: 100,
    })
    expect(score).toBe(5)
  })
  it("Unter-Zielwert: 1e9 + Abweichung (95 bei Ziel 100 → 1e9+5)", () => {
    const score = calculateScore("TARGET_OVER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 95,
      targetValue: 100,
    })
    expect(score).toBe(1e9 + 5)
  })
  it("Über-Wert gewinnt immer gegen Unter-Wert", () => {
    const over = calculateScore("TARGET_OVER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 150,
      targetValue: 100,
    })
    const under = calculateScore("TARGET_OVER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 99,
      targetValue: 100,
    })
    expect(over).toBeLessThan(under)
  })
  it("exakt auf Zielwert → Score 0 (über-Tier)", () => {
    const score = calculateScore("TARGET_OVER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 100,
      targetValue: 100,
    })
    expect(score).toBe(0)
  })
})

describe("calculateScore – TARGET_UNDER", () => {
  it("Unter-Zielwert: Abweichung direkt (95 bei Ziel 100 → 5)", () => {
    const score = calculateScore("TARGET_UNDER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 95,
      targetValue: 100,
    })
    expect(score).toBe(5)
  })
  it("Über-Zielwert: 1e9 + Abweichung (105 bei Ziel 100 → 1e9+5)", () => {
    const score = calculateScore("TARGET_UNDER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 105,
      targetValue: 100,
    })
    expect(score).toBe(1e9 + 5)
  })
  it("Unter-Wert gewinnt immer gegen Über-Wert", () => {
    const under = calculateScore("TARGET_UNDER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 50,
      targetValue: 100,
    })
    const over = calculateScore("TARGET_UNDER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 101,
      targetValue: 100,
    })
    expect(under).toBeLessThan(over)
  })
  it("exakt auf Zielwert → Score 0 (unter-Tier)", () => {
    const score = calculateScore("TARGET_UNDER", {
      rings: 0,
      teiler: 0,
      faktor: 1,
      maxRings: 100,
      measuredValue: 100,
      targetValue: 100,
    })
    expect(score).toBe(0)
  })
})

describe("effectiveTeilerFaktor", () => {
  it("feste Disziplin (disciplineId gesetzt) → Faktor 1.0", () => {
    expect(effectiveTeilerFaktor("disc-1", 0.3333333)).toBe(1)
    expect(effectiveTeilerFaktor("disc-1", 1.8)).toBe(1)
  })
  it("gemischte Disziplin (disciplineId null) → Faktor unverändert", () => {
    expect(effectiveTeilerFaktor(null, 0.3333333)).toBe(0.3333333)
    expect(effectiveTeilerFaktor(null, 1.0)).toBe(1.0)
  })
})
