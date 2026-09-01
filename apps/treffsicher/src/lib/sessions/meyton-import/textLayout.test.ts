import { describe, expect, it } from "vitest"
import { buildTextLinesFromItems } from "@/lib/sessions/meyton-import/textLayout"

describe("buildTextLinesFromItems", () => {
  it("gruppiert nach y und sortiert Zeilen von oben nach unten", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "unten", x: 10, y: 100 },
      { page: 1, str: "b", x: 50, y: 200 },
      { page: 1, str: "a", x: 10, y: 201 },
    ])

    expect(lines).toEqual(["a b", "unten"])
  })

  it("verwirft Grafik-Nummern links der Serie-Spalte", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "Serie 1:", x: 154, y: 584 },
      { page: 1, str: "96.3", x: 191, y: 584 },
      { page: 1, str: "8", x: 95, y: 584 },
      { page: 1, str: "10.0", x: 199, y: 572 },
      { page: 1, str: "9.7", x: 512, y: 572 },
      { page: 1, str: "9", x: 63, y: 552 },
      { page: 1, str: "8", x: 128, y: 552 },
    ])

    // Die reine Grafik-Zeile (y=552) entfaellt komplett - sie darf nicht als
    // Leerzeile erscheinen, sonst bricht der Serien-Parser den Schussblock ab.
    expect(lines).toEqual(["Serie 1: 96.3", "10.0 9.7"])
  })

  it("filtert vor dem ersten Serie-Anker nicht", () => {
    const lines = buildTextLinesFromItems([{ page: 1, str: "StandNr: 8", x: 57, y: 764 }])

    expect(lines).toEqual(["StandNr: 8"])
  })

  it("zieht die Spaltenkante bei jeder neuen Serie nach", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "Serie 1:", x: 154, y: 500 },
      { page: 1, str: "9.5", x: 200, y: 490 },
      { page: 1, str: "3", x: 60, y: 490 },
      { page: 1, str: "Serie 2:", x: 300, y: 400 },
      { page: 1, str: "9.9", x: 340, y: 390 },
      // Liegt links der neuen Kante, aber rechts der alten - muss trotzdem raus.
      { page: 1, str: "7", x: 200, y: 390 },
    ])

    expect(lines).toEqual(["Serie 1:", "9.5", "Serie 2:", "9.9"])
  })

  it("ignoriert leere und reine Whitespace-Items", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "  ", x: 10, y: 100 },
      { page: 1, str: "", x: 20, y: 100 },
      { page: 1, str: "Text", x: 30, y: 100 },
    ])

    expect(lines).toEqual(["Text"])
  })

  it("trennt Zeilen erst ausserhalb der y-Toleranz", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "a", x: 10, y: 200 },
      // 2 pt Versatz - gleiche Zeile (Toleranz 3).
      { page: 1, str: "b", x: 20, y: 198 },
      // 5 pt Versatz - neue Zeile.
      { page: 1, str: "c", x: 30, y: 193 },
    ])

    expect(lines).toEqual(["a b", "c"])
  })

  it("vermischt Seiten mit identischen y-Werten nicht", () => {
    // y-Koordinaten sind seitenlokal und wiederholen sich im selben Report-Template
    // auf jeder Seite exakt. Ohne Seitentrennung landeten beide Serien in einer
    // Zeile und die Schuesse beider Seiten in einer einzigen Serie.
    const lines = buildTextLinesFromItems([
      { page: 1, str: "Serie 1:", x: 154, y: 584 },
      { page: 1, str: "10.0", x: 199, y: 572 },
      { page: 1, str: "9.7", x: 300, y: 572 },
      { page: 2, str: "Serie 2:", x: 154, y: 584 },
      { page: 2, str: "5.1", x: 199, y: 572 },
      { page: 2, str: "5.2", x: 300, y: 572 },
    ])

    expect(lines).toEqual(["Serie 1:", "10.0 9.7", "Serie 2:", "5.1 5.2"])
  })

  it("haelt die Reihenfolge der Seiten ein", () => {
    const lines = buildTextLinesFromItems([
      { page: 2, str: "zweite Seite", x: 10, y: 800 },
      { page: 1, str: "erste Seite", x: 10, y: 100 },
    ])

    expect(lines).toEqual(["erste Seite", "zweite Seite"])
  })

  it("setzt die Spaltenkante zum Seitenanfang zurueck", () => {
    const lines = buildTextLinesFromItems([
      { page: 1, str: "Serie 1:", x: 400, y: 500 },
      { page: 1, str: "9.5", x: 450, y: 490 },
      // Auf Seite 2 gilt die Kante von Seite 1 nicht mehr.
      { page: 2, str: "StandNr: 8", x: 57, y: 764 },
    ])

    expect(lines).toEqual(["Serie 1:", "9.5", "StandNr: 8"])
  })

  it("findet den Anker auch wenn 'Serie 1:' auf zwei Items aufgeteilt ist", () => {
    // Qt/Identity-H emittiert ein Glyph pro Tj; pdf.js fasst nur heuristisch
    // zusammen. Ohne Anker faellt der Spaltenfilter still aus (fail-open).
    const lines = buildTextLinesFromItems([
      { page: 1, str: "8", x: 95, y: 584 },
      { page: 1, str: "Serie", x: 154, y: 584 },
      { page: 1, str: "1:", x: 180, y: 584 },
      { page: 1, str: "96.3", x: 200, y: 584 },
      { page: 1, str: "9", x: 63, y: 572 },
      { page: 1, str: "10.0", x: 199, y: 572 },
    ])

    expect(lines).toEqual(["Serie 1: 96.3", "10.0"])
  })
})
