import { describe, expect, it } from "vitest"

import { decodePrintoutId, findPrintoutId } from "./printoutId"

describe("decodePrintoutId", () => {
  it("liest acht Hex-Zeichen als vorzeichenbehaftete 32-Bit-Zahl", () => {
    expect(decodePrintoutId("ff914420")).toBe(-7257056)
    expect(decodePrintoutId("46a13c20")).toBe(1184971808)
    expect(decodePrintoutId("ed850812")).toBe(-310048750)
    expect(decodePrintoutId("80000000")).toBe(-2147483648)
    expect(decodePrintoutId("7fffffff")).toBe(2147483647)
    expect(decodePrintoutId("00000000")).toBe(0)
    expect(decodePrintoutId("ffffffff")).toBe(-1)
    expect(decodePrintoutId("FF914420")).toBe(-7257056)
  })

  it("lehnt andere Formate ab", () => {
    for (const hex of ["ff91442", "ff9144200", "gg914420", "", " ff914420"]) {
      expect(() => decodePrintoutId(hex), hex).toThrow(RangeError)
    }
  })
})

describe("findPrintoutId", () => {
  it("findet die ID im Fuß, wie pdf.js ihn liefert", () => {
    expect(findPrintoutId(["LP 40 alt StandNr: 8 ID: ff914420 - Seite: 1 (C) Meyton"])).toEqual({
      kind: "found",
      hex: "ff914420",
      value: -7257056,
      pages: [1],
    })
  })

  it("Großbuchstaben und echtes Minuszeichen (Ghostscript)", () => {
    expect(findPrintoutId(["ID: ED850812 − Seite: 1"])).toMatchObject({
      kind: "found",
      hex: "ed850812",
      value: -310048750,
    })
  })

  it("einzeln gesetzte Glyphen mit Leerzeichen dazwischen (Qt)", () => {
    expect(findPrintoutId(["I D :  f f 9 1 4 4 2 0 - S e i t e : 1"])).toMatchObject({
      kind: "found",
      hex: "ff914420",
    })
  })

  it("mehrere Leerzeichen zwischen den Glyphen (pdf.js setzt Lücken als eigene Stücke)", () => {
    expect(findPrintoutId(["I   D   :   f   f   9   1   4   4   2   0   -   S"])).toMatchObject({
      kind: "found",
      hex: "ff914420",
    })
  })

  it("sucht auf allen Seiten (SF-44)", () => {
    const footer = "ID: ff914420 - Seite: "
    expect(findPrintoutId([`${footer}1`, `${footer}2`, `${footer}3`])).toMatchObject({
      kind: "found",
      pages: [1, 2, 3],
    })
    expect(findPrintoutId(["Kopf", "Serien", `${footer}3`])).toMatchObject({
      kind: "found",
      pages: [3],
    })
  })

  it("trifft nichts, was nur ähnlich aussieht", () => {
    for (const text of [
      "DisziplinID: 19210040",
      "ID: ff9144201",
      "ID: ff914420x",
      "ID: ff91442",
      "Seite: 1",
      "",
    ]) {
      expect(findPrintoutId([text]), text).toEqual({ kind: "missing" })
    }
    expect(findPrintoutId([])).toEqual({ kind: "missing" })
  })

  it("fügt keine getrennten Wörter zu einer ID zusammen", () => {
    for (const text of [
      "Verein-ID: 123 Bad 45",
      "ID: ab cd ef 12",
      "ID: ff9144 20",
      "ÄID: ff914420",
    ]) {
      expect(findPrintoutId([text]), text).toEqual({ kind: "missing" })
    }
  })

  it("kennt keine Beschriftungen: Disziplin-ID zählt als ID (Vorschau und Bestätigung schützen, SF-41)", () => {
    expect(findPrintoutId(["Disziplin-ID: 19210040"])).toMatchObject({
      kind: "found",
      hex: "19210040",
    })
  })

  it("ein Trennzeichen davor stört nicht", () => {
    expect(findPrintoutId(["Ausdruck-ID: 46a13c20"])).toMatchObject({
      kind: "found",
      hex: "46a13c20",
      value: 1184971808,
    })
  })

  it("verschiedene IDs sind ein Widerspruch, kein Raten", () => {
    expect(findPrintoutId(["ID: ff914420 - Seite: 1", "ID: 46a13c20 - Seite: 2"])).toEqual({
      kind: "conflict",
      hexes: ["46a13c20", "ff914420"],
    })
    expect(findPrintoutId(["ID: ff914420 und ID: 46a13c20"])).toEqual({
      kind: "conflict",
      hexes: ["46a13c20", "ff914420"],
    })
  })
})
