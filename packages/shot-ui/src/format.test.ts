import { describe, expect, it } from "vitest"

import { formatSigned, formatValue, unitText } from "./format"

describe("Zahlen wie in der Spielwiese: feste Stellen, Komma, echtes Minus", () => {
  it("feste Nachkommastellen mit Komma", () => {
    expect(formatValue(1.234, 2)).toBe("1,23")
    expect(formatValue(12, 0)).toBe("12")
    expect(formatValue(10.96, 1)).toBe("11,0")
  })

  it("Minus als echtes Minus, aber nie vor einer gerundeten Null", () => {
    expect(formatValue(-0.5, 1)).toBe("−0,5")
    expect(formatValue(-0.04, 1)).toBe("0,0")
  })

  it("kein Tausenderpunkt, wie auf dem Ausdruck (Teiler 3831,0)", () => {
    expect(formatValue(3831, 1)).toBe("3831,0")
  })

  it("mit Vorzeichen für Abweichungen", () => {
    expect(formatSigned(1.5, 1)).toBe("+1,5")
    expect(formatSigned(-1.5, 1)).toBe("−1,5")
    expect(formatSigned(0.01, 1)).toBe("0,0")
  })
})

describe("Einheiten der Kennzahlen", () => {
  it("wie in der Spielwiese; der Teiler steht ohne Einheit", () => {
    expect(unitText("Ringe")).toBe("Ringe")
    expect(unitText("mm")).toBe("mm")
    expect(unitText("s")).toBe("s")
    expect(unitText("%")).toBe("%")
    expect(unitText("Schuss")).toBe("Schuss")
    expect(unitText("Teiler")).toBe("")
  })
})
