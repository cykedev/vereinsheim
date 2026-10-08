import { describe, expect, it } from "vitest"

import {
  directionWords,
  durationText,
  formatSigned,
  formatValue,
  percentText,
  unitText,
} from "./format"

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

describe("Dauer, Anteil und Richtung in Worten", () => {
  it("Dauer: Sekunden, ab einer Minute m:ss min, ab einer Stunde h:mm h", () => {
    expect(durationText(42_000)).toBe("42 s")
    expect(durationText(59_400)).toBe("59 s")
    expect(durationText(185_000)).toBe("3:05 min")
    expect(durationText(3_720_000)).toBe("1:02 h")
  })

  it("Anteil in ganzen Prozent", () => {
    expect(percentText(0.234)).toBe("23 %")
    expect(percentText(1)).toBe("100 %")
    expect(percentText(0)).toBe("0 %")
  })

  it("Richtung in Worten für Sätze, unter 0,05 mm je Richtung mittig", () => {
    expect(directionWords({ xUm: 2500, yUm: -1200 })).toBe("2,5 mm rechts und 1,2 mm tief")
    expect(directionWords({ xUm: -800, yUm: 30 })).toBe("0,8 mm links")
    expect(directionWords({ xUm: 10, yUm: 900 })).toBe("0,9 mm hoch")
    expect(directionWords({ xUm: 30, yUm: -40 })).toBe("mittig")
  })
})
