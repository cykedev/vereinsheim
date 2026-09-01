import { describe, expect, it } from "vitest"
import { parseMeytonSeriesFromText } from "@/lib/sessions/meyton-import/series"

describe("parseMeytonSeriesFromText", () => {
  it("startet den Schussblock erst ab der ersten validen Zahlenzeile", () => {
    const text = `
Serie 1:
Name: Athlet
Verein: XYZ
9.8 10.1 9.4
9.7 9.8 9.9
`

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [{ nr: 1, shots: [9.8, 10.1, 9.4, 9.7, 9.8, 9.9] }],
    })
  })

  it("beendet den Schussblock bei erster leerer/nicht numerischer Folge nach Start", () => {
    const text = `
Serie 2:
10.0 9.9 9.8
Kommentar: Abbruch
10.0 10.0 10.0
`

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [{ nr: 2, shots: [10, 9.9, 9.8] }],
    })
  })

  it("beendet den Schussblock bei 'Zähler:' trotz Umlaut", () => {
    // Die Zaehler-Zeile besteht nur aus Werten im gueltigen Schussbereich —
    // ohne Umlaut-Treffer im Stop-Keyword landen sie als Phantom-Schuesse in der Serie.
    const text = `
Serie 1:
9.8 10.1 9.4
Zähler: 18 16 6 0 0 0 0 0 0 0 0
`

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [{ nr: 1, shots: [9.8, 10.1, 9.4] }],
    })
  })

  it("beendet den Schussblock bei 'Trefferkreis:'", () => {
    // Ein enger Trefferkreis liegt im gueltigen Schussbereich (hier 9.87 mm) —
    // ohne Stop-Keyword wuerde er als zusaetzlicher Schuss 9.9 gelesen.
    const text = `
Serie 2:
10.0 9.9
Trefferkreis: 9.87 mm
`

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [{ nr: 2, shots: [10, 9.9] }],
    })
  })

  it("ignoriert Werte ausserhalb 0..10.9", () => {
    const text = `
Serie 3:
11.2 10.9 12.0 0.0 9.5
`

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [{ nr: 3, shots: [10.9, 0, 9.5] }],
    })
  })
})
