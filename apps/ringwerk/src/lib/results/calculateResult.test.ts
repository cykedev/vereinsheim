import { describe, it, expect } from "vitest"
import { calculateRingteiler, determineOutcome, MAX_RINGS } from "./calculateResult"

describe("MAX_RINGS", () => {
  it("WHOLE hat Maximalringe 100", () => {
    expect(MAX_RINGS.WHOLE).toBe(100)
  })
  it("DECIMAL hat Maximalringe 109", () => {
    expect(MAX_RINGS.DECIMAL).toBe(109)
  })
})

describe("calculateRingteiler", () => {
  it("berechnet Ringteiler korrekt für Ganzring (Beispiel aus features.md: A)", () => {
    // 96 Ringe, Teiler 3.7, Faktor 1.0 → RT 7.7
    expect(calculateRingteiler(96, 3.7, 1.0, 100)).toBeCloseTo(7.7)
  })

  it("berechnet Ringteiler korrekt für Ganzring (Beispiel aus features.md: B)", () => {
    // 96 Ringe, Teiler 4.2, Faktor 1.0 → RT 8.2
    expect(calculateRingteiler(96, 4.2, 1.0, 100)).toBeCloseTo(8.2)
  })

  it("berechnet Ringteiler korrekt für Zehntelring (Beispiel aus features.md: A)", () => {
    // 104.5 Ringe, Teiler 2.1, Faktor 1.0 → RT 6.6
    expect(calculateRingteiler(104.5, 2.1, 1.0, 109)).toBeCloseTo(6.6)
  })

  it("berechnet Ringteiler korrekt für Zehntelring (Beispiel aus features.md: B)", () => {
    // 105.0 Ringe, Teiler 1.8, Faktor 1.0 → RT 5.8
    expect(calculateRingteiler(105.0, 1.8, 1.0, 109)).toBeCloseTo(5.8)
  })

  it("wendet teilerFaktor an (Luftpistole 0.3333333)", () => {
    // 90 Ringe, Teiler 60, Faktor 1/3 → RT = 100 - 90 + 20.0 = 30.0
    expect(calculateRingteiler(90, 60, 0.3333333, 100)).toBe(30.0)
  })

  it("niedrigerer Ringteiler bei besserem Schützen", () => {
    const a = calculateRingteiler(96, 3.7, 1.0, 100)
    const b = calculateRingteiler(96, 4.2, 1.0, 100)
    expect(a).toBeLessThan(b)
  })
})

describe("determineOutcome", () => {
  it("HOME_WIN wenn Heim niedrigeren Ringteiler hat", () => {
    const home = { rings: 96, teiler: 3.7, ringteiler: 7.7 }
    const away = { rings: 96, teiler: 4.2, ringteiler: 8.2 }
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("AWAY_WIN wenn Gast niedrigeren Ringteiler hat", () => {
    const home = { rings: 104.5, teiler: 2.1, ringteiler: 6.6 }
    const away = { rings: 105.0, teiler: 1.8, ringteiler: 5.8 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })

  it("Tiebreak 1: höhere Seriensumme gewinnt bei gleichem Ringteiler", () => {
    const home = { rings: 95, teiler: 5.0, ringteiler: 10.0 }
    const away = { rings: 93, teiler: 7.0, ringteiler: 10.0 }
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("Tiebreak 2: kleinerer Teiler gewinnt wenn Ringe und RT gleich", () => {
    const home = { rings: 95, teiler: 4.0, ringteiler: 10.0 }
    const away = { rings: 95, teiler: 5.0, ringteiler: 10.0 }
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("DRAW wenn alle Werte identisch", () => {
    const result = { rings: 95, teiler: 5.0, ringteiler: 10.0 }
    expect(determineOutcome(result, result)).toBe("DRAW")
  })

  it("Tiebreak: Gast gewinnt bei höherer Serie", () => {
    const home = { rings: 90, teiler: 10.0, ringteiler: 20.0 }
    const away = { rings: 92, teiler: 12.0, ringteiler: 20.0 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })

  it("Tiebreak: Gast gewinnt bei kleinerem Teiler (gleiche Ringe, gleicher RT)", () => {
    const home = { rings: 95, teiler: 6.0, ringteiler: 11.0 }
    const away = { rings: 95, teiler: 5.0, ringteiler: 11.0 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })

  it("scoringMode RINGTEILER: explizit übergeben", () => {
    const home = { rings: 96, teiler: 3.7, ringteiler: 7.7 }
    const away = { rings: 96, teiler: 4.2, ringteiler: 8.2 }
    expect(determineOutcome(home, away, "RINGTEILER")).toBe("HOME_WIN")
  })

  describe("scoringMode RINGS", () => {
    it("höhere Seriensumme gewinnt (HOME_WIN)", () => {
      const home = { rings: 97, teiler: 5.0, ringteiler: 8.0 }
      const away = { rings: 95, teiler: 3.0, ringteiler: 8.0 }
      expect(determineOutcome(home, away, "RINGS")).toBe("HOME_WIN")
    })

    it("höhere Seriensumme gewinnt (AWAY_WIN)", () => {
      const home = { rings: 93, teiler: 2.0, ringteiler: 9.0 }
      const away = { rings: 96, teiler: 5.0, ringteiler: 9.0 }
      expect(determineOutcome(home, away, "RINGS")).toBe("AWAY_WIN")
    })

    it("Tiebreak: kleinerer Teiler bei gleichen Ringen", () => {
      const home = { rings: 95, teiler: 3.0, ringteiler: 8.0 }
      const away = { rings: 95, teiler: 4.0, ringteiler: 8.0 }
      expect(determineOutcome(home, away, "RINGS")).toBe("HOME_WIN")
    })

    it("DRAW bei vollständigem Gleichstand", () => {
      const result = { rings: 95, teiler: 3.0, ringteiler: 8.0 }
      expect(determineOutcome(result, result, "RINGS")).toBe("DRAW")
    })
  })

  describe("scoringMode RINGS_DECIMAL", () => {
    it("verhält sich identisch zu RINGS", () => {
      const home = { rings: 104.5, teiler: 2.0, ringteiler: 6.5 }
      const away = { rings: 103.0, teiler: 1.5, ringteiler: 7.5 }
      expect(determineOutcome(home, away, "RINGS_DECIMAL")).toBe("HOME_WIN")
    })
  })

  describe("scoringMode TEILER", () => {
    it("kleinerer Teiler gewinnt (HOME_WIN)", () => {
      const home = { rings: 90, teiler: 3.0, ringteiler: 13.0 }
      const away = { rings: 95, teiler: 5.0, ringteiler: 10.0 }
      expect(determineOutcome(home, away, "TEILER")).toBe("HOME_WIN")
    })

    it("kleinerer Teiler gewinnt (AWAY_WIN)", () => {
      const home = { rings: 95, teiler: 6.0, ringteiler: 11.0 }
      const away = { rings: 90, teiler: 4.0, ringteiler: 14.0 }
      expect(determineOutcome(home, away, "TEILER")).toBe("AWAY_WIN")
    })

    it("Tiebreak: höhere Ringe bei gleichem Teiler", () => {
      const home = { rings: 96, teiler: 3.0, ringteiler: 7.0 }
      const away = { rings: 94, teiler: 3.0, ringteiler: 9.0 }
      expect(determineOutcome(home, away, "TEILER")).toBe("HOME_WIN")
    })

    it("DRAW bei vollständigem Gleichstand", () => {
      const result = { rings: 95, teiler: 3.0, ringteiler: 8.0 }
      expect(determineOutcome(result, result, "TEILER")).toBe("DRAW")
    })
  })
})
