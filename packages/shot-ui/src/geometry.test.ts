import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import {
  groupView,
  scoreColor,
  screenSizes,
  seriesTileView,
  targetView,
  tileColumns,
  unitsPerPixel,
} from "./geometry"

// Erwartungswerte von Hand aus den Regeln (Spielwiese, spiegel-ui-design „Zeichnen der Scheibe“):
// LP Ring 1 Radius 5,75 + 9 · 8 = 77,75 mm, LG 0,25 + 9 · 2,5 = 22,75 mm, Kaliber 4,5 mm (halb 2,25).

const close = (actual: { x: number; y: number; w: number }, x: number, y: number, w: number) => {
  expect(actual.x).toBeCloseTo(x, 9)
  expect(actual.y).toBeCloseTo(y, 9)
  expect(actual.w).toBeCloseTo(w, 9)
}

describe("Ausschnitt der ganzen Scheibe", () => {
  it("Ring 1 plus Rand: 10 % des Radius, mindestens 4 mm", () => {
    // LP: 77,75 + 7,775 = 85,525
    close(targetView(LP_10M), -85.525, -85.525, 171.05)
    // LG: 22,75 + 4 (10 % wären nur 2,275)
    close(targetView(LG_10M), -26.75, -26.75, 53.5)
  })
})

describe("Ausschnitt der Gruppe", () => {
  it("Streukreis plus halbes Kaliber, um 30 % erweitert, mindestens fünf halbe Kaliber", () => {
    // LG, zwei Schuss 2 mm auseinander: Kreis um (1 | 0) mit 1 mm; (1 + 2,25) · 1,3 = 4,225 < 11,25
    close(
      groupView(LG_10M, [
        { xUm: 0, yUm: 0 },
        { xUm: 2000, yUm: 0 },
      ]),
      1 - 11.25,
      -11.25,
      22.5
    )
    // LP, 20 mm auseinander bei y = 3 mm: (10 + 2,25) · 1,3 = 15,925; y nach unten, also −3 − 15,925
    close(
      groupView(LP_10M, [
        { xUm: -10000, yUm: 3000 },
        { xUm: 10000, yUm: 3000 },
      ]),
      -15.925,
      -18.925,
      31.85
    )
  })

  it("ohne Treffer die ganze Scheibe", () => {
    expect(groupView(LP_10M, [])).toEqual(targetView(LP_10M))
  })
})

describe("Größen in Bildschirm-Pixeln", () => {
  it("eng gezoomt (0,1 mm je Pixel): Nummern und Schwerpunkt an der Obergrenze", () => {
    const s = screenSizes(LP_10M, 0.1)
    // Treffer 45 px breit: Nummer 23,4 px → höchstens 12 px; Schwerpunkt 12,4 px → höchstens 8 px
    expect(s.numberFont).toBeCloseTo(1.2, 9)
    expect(s.numberHalo).toBeCloseTo(0.24, 9)
    expect(s.mpiRadius).toBeCloseTo(0.8, 9)
    // Ringzahl: 62 % des Rings (4,96 mm) oder 12 px (1,2 mm), das Kleinere
    expect(s.ringLabel).toBeCloseTo(1.2, 9)
    expect(s.spreadGap).toBeCloseTo(0.2, 9)
  })

  it("weit gezoomt (1 mm je Pixel): Nummern und Schwerpunkt an der Untergrenze", () => {
    const s = screenSizes(LG_10M, 1)
    // Treffer 4,5 px: Nummer 2,34 px → mindestens 8 px; Schwerpunkt 1,24 px → mindestens 5 px
    expect(s.numberFont).toBeCloseTo(8, 9)
    expect(s.mpiRadius).toBeCloseTo(5, 9)
    // Ringzahl: 62 % von 2,5 mm = 1,55 mm, kleiner als 12 px
    expect(s.ringLabel).toBeCloseTo(1.55, 9)
    expect(s.spreadGap).toBeCloseTo(2, 9)
  })

  it("Einheiten je Pixel aus Ausschnitt und Breite, ohne Breite 600 px", () => {
    expect(unitsPerPixel({ x: 0, y: 0, w: 60 }, 300)).toBeCloseTo(0.2, 9)
    expect(unitsPerPixel({ x: 0, y: 0, w: 60 }, 0)).toBeCloseTo(0.1, 9)
  })
})

describe("Ringwert-Farben", () => {
  it("10 rot, 9 gold, 8 türkis, alles darunter violett, auch ein Fehlschuss", () => {
    expect(scoreColor(10)).toBe("var(--score-10)")
    expect(scoreColor(9)).toBe("var(--score-9)")
    expect(scoreColor(8)).toBe("var(--score-8)")
    expect(scoreColor(7)).toBe("var(--score-7)")
    expect(scoreColor(0)).toBe("var(--score-7)")
  })
})

describe("Serien als kleine Scheiben", () => {
  it("ein gemeinsamer Ausschnitt um die Mitte: weitester Treffer plus halbes Kaliber, 12 % Luft", () => {
    // LP: weitester Treffer 4 mm in y, (4 + 2,25) · 1,12 = 7 < sechs halbe Kaliber (13,5)
    close(
      seriesTileView(LP_10M, [
        { xUm: 3000, yUm: -1000 },
        { xUm: 500, yUm: 4000 },
      ]),
      -13.5,
      -13.5,
      27
    )
    // LG: Treffer bei 30 mm, (30 + 2,25) · 1,12 = 36,12, höchstens Ring 1 plus halbes Kaliber (25)
    close(seriesTileView(LG_10M, [{ xUm: 30000, yUm: 0 }]), -25, -25, 50)
  })

  it("ohne Treffer sechs halbe Kaliber", () => {
    close(seriesTileView(LG_10M, []), -13.5, -13.5, 27)
  })

  it("gleich volle Zeilen: so viele Spalten wie 70 px passen, dann gleichmäßig verteilt", () => {
    // 300 px: 4 passen; 5 Kacheln → 2 Zeilen → 3 Spalten (3 + 2), nicht 4 + 1
    expect(tileColumns(5, 300)).toBe(3)
    expect(tileColumns(4, 300)).toBe(4)
    // 400 px: 5 passen; 11 Kacheln → 3 Zeilen → 4 Spalten
    expect(tileColumns(11, 400)).toBe(4)
    expect(tileColumns(9, 700)).toBe(9)
    // ohne Breite eine Spalte, ohne Kacheln auch
    expect(tileColumns(5, 0)).toBe(1)
    expect(tileColumns(0, 300)).toBe(1)
  })
})
