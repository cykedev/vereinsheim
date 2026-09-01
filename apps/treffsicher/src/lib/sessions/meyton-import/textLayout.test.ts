import { describe, expect, it } from "vitest"
import { buildTextLinesFromItems } from "@/lib/sessions/meyton-import/textLayout"

describe("buildTextLinesFromItems", () => {
  it("gruppiert nach y und sortiert Zeilen von oben nach unten", () => {
    const lines = buildTextLinesFromItems([
      { str: "unten", x: 10, y: 100 },
      { str: "b", x: 50, y: 200 },
      { str: "a", x: 10, y: 201 },
    ])

    expect(lines).toEqual(["a b", "unten"])
  })

  it("verwirft Grafik-Nummern links der Serie-Spalte", () => {
    const lines = buildTextLinesFromItems([
      { str: "Serie 1:", x: 154, y: 584 },
      { str: "96.3", x: 191, y: 584 },
      { str: "8", x: 95, y: 584 },
      { str: "10.0", x: 199, y: 572 },
      { str: "9.7", x: 512, y: 572 },
      { str: "9", x: 63, y: 552 },
      { str: "8", x: 128, y: 552 },
    ])

    // Die reine Grafik-Zeile (y=552) entfaellt komplett - sie darf nicht als
    // Leerzeile erscheinen, sonst bricht der Serien-Parser den Schussblock ab.
    expect(lines).toEqual(["Serie 1: 96.3", "10.0 9.7"])
  })

  it("filtert vor dem ersten Serie-Anker nicht", () => {
    const lines = buildTextLinesFromItems([{ str: "StandNr: 8", x: 57, y: 764 }])

    expect(lines).toEqual(["StandNr: 8"])
  })

  it("zieht die Spaltenkante bei jeder neuen Serie nach", () => {
    const lines = buildTextLinesFromItems([
      { str: "Serie 1:", x: 154, y: 500 },
      { str: "9.5", x: 200, y: 490 },
      { str: "3", x: 60, y: 490 },
      { str: "Serie 2:", x: 300, y: 400 },
      { str: "9.9", x: 340, y: 390 },
      // Liegt links der neuen Kante, aber rechts der alten - muss trotzdem raus.
      { str: "7", x: 200, y: 390 },
    ])

    expect(lines).toEqual(["Serie 1:", "9.5", "Serie 2:", "9.9"])
  })

  it("ignoriert leere und reine Whitespace-Items", () => {
    const lines = buildTextLinesFromItems([
      { str: "  ", x: 10, y: 100 },
      { str: "", x: 20, y: 100 },
      { str: "Text", x: 30, y: 100 },
    ])

    expect(lines).toEqual(["Text"])
  })

  it("trennt Zeilen erst ausserhalb der y-Toleranz", () => {
    const lines = buildTextLinesFromItems([
      { str: "a", x: 10, y: 200 },
      // 2 pt Versatz - gleiche Zeile (Toleranz 3).
      { str: "b", x: 20, y: 198 },
      // 5 pt Versatz - neue Zeile.
      { str: "c", x: 30, y: 193 },
    ])

    expect(lines).toEqual(["a b", "c"])
  })
})
