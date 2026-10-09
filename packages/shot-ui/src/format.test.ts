import { describe, expect, it } from "vitest"

import {
  axisText,
  directionName,
  directionWords,
  durationText,
  formatSigned,
  formatValue,
  percentText,
  ringsText,
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

describe("Achse einer Gruppe in Worten", () => {
  it("Winkel ab 3 Uhr gegen den Uhrzeigersinn, Uhrzeiten wie die Richtungsuhr (Prüfung, Präzision 3)", () => {
    const rad = (deg: number) => (deg * Math.PI) / 180
    expect(axisText(rad(111))).toBe(
      "längs etwa 11 bis 5 Uhr (111°, gegen den Uhrzeigersinn ab 3 Uhr)"
    )
    expect(axisText(rad(90))).toBe(
      "längs etwa 12 bis 6 Uhr (90°, gegen den Uhrzeigersinn ab 3 Uhr)"
    )
    expect(axisText(rad(20))).toBe("längs etwa 2 bis 8 Uhr (20°, gegen den Uhrzeigersinn ab 3 Uhr)")
  })

  it("auf ganze Grad modulo 180: 179,6° ist 0°, nicht 180°", () => {
    expect(axisText((179.6 * Math.PI) / 180)).toBe(
      "längs etwa 3 bis 9 Uhr (0°, gegen den Uhrzeigersinn ab 3 Uhr)"
    )
  })
})

describe("Richtung ohne Zahl", () => {
  it("acht Richtungen, schräg erst ab 22,5° neben der Achse; unter 0,05 mm mittig (Prüfung, Probe 11)", () => {
    expect(directionName({ xUm: 472, yUm: 18 })).toBe("rechts")
    expect(directionName({ xUm: 3000, yUm: 3000 })).toBe("rechts oben")
    expect(directionName({ xUm: -2928, yUm: 5998 })).toBe("links oben")
    expect(directionName({ xUm: -1000, yUm: -300 })).toBe("links")
    expect(directionName({ xUm: 100, yUm: -900 })).toBe("unten")
    expect(directionName({ xUm: 30, yUm: -40 })).toBe("mittig")
  })
})

describe("Ringe mit Zahl", () => {
  it("ein Ring nur bei genau 1, sonst Ringe (Prüfung, Grammatik)", () => {
    expect(ringsText(1, 0)).toBe("1 Ring")
    expect(ringsText(-1, 0)).toBe("−1 Ring")
    expect(ringsText(2, 0)).toBe("2 Ringe")
    expect(ringsText(1, 1)).toBe("1,0 Ringe")
    expect(ringsText(0.04, 0)).toBe("0 Ringe")
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
