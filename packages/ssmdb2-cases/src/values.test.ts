import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import {
  displayText,
  hiddenValues,
  overTargetValues,
  PLACEHOLDER_TEILER,
  shotValues,
} from "./values"

describe("Werte eines Schusses wie in der Ablage", () => {
  it("Teiler aus der Lage in 1/100 mm: Teiler01 in µm, Teiler001 in 0,1 µm", () => {
    // 3 mm und 4 mm: 5 mm Abstand
    expect(shotValues(LG_10M, 300, 400)).toMatchObject({ Teiler01: 5000, Teiler001: 50000 })
    // √(1² + 1²) mm = 1414,21 µm
    expect(shotValues(LG_10M, 100, 100)).toMatchObject({ Teiler01: 1414, Teiler001: 14142 })
  })

  it("Mitte: 10,9 mit Innenzehner; Ring in Zehnteln als ganzer Ring mal zehn", () => {
    expect(shotValues(LP_10M, 0, 0)).toEqual({
      Ring: 100,
      Ring01: 109,
      Innenzehner: 1,
      Teiler01: 0,
      Teiler001: 0,
    })
    const nine = shotValues(LP_10M, 0, 1200)
    expect(nine.Ring).toBe(Math.floor(nine.Ring01 / 10) * 10)
  })

  it("über der Soll-Zahl (SF-08): Wert 0, Platzhalter-Teiler; verdeckt (SF-19): Wert 0, Teiler bleibt", () => {
    expect(PLACEHOLDER_TEILER).toBe(2147483647)
    expect(overTargetValues()).toEqual({
      Ring: 0,
      Ring01: 0,
      Innenzehner: 0,
      Teiler01: 2147483647,
      Teiler001: 2147483647,
    })
    expect(hiddenValues(shotValues(LP_10M, 300, 400))).toEqual({
      Ring: 0,
      Ring01: 0,
      Innenzehner: 0,
      Teiler01: 5000,
      Teiler001: 50000,
    })
  })

  it("`Text` je Anzeigeart wie in der Kopie vom 9. Oktober 2026", () => {
    const v = (Ring01: number, Teiler01: number, Innenzehner: 0 | 1 = 0) => ({
      Ring: Math.floor(Ring01 / 10) * 10,
      Ring01,
      Innenzehner,
      Teiler01,
      Teiler001: Teiler01 * 10,
    })
    expect(displayText(2, v(98, 9506))).toBe("9")
    expect(displayText(2, v(105, 3964, 1))).toBe("10*")
    expect(displayText(1, v(101, 6000))).toBe("10.1")
    expect(displayText(1, v(47, 60000))).toBe("4.7")
    // Teiler in 1/100 mm, abgeschnitten: 1767,5 steht als 1767
    expect(displayText(7, v(99, 8510))).toBe("9.9 851T")
    expect(displayText(7, v(87, 17675))).toBe("8.7 1767T")
    expect(displayText(8, v(95, 9958))).toBe("9 995T")
    expect(displayText(5, v(0, 4944))).toBe("***")
    expect(displayText(2, overTargetValues(), true)).toBe("0F")
  })
})
