import { describe, expect, it } from "vitest"

import { eveningOfStart, parseCardId, printedId } from "./id"

describe("parseCardId", () => {
  it("liest die ID wie im Fuß des Ausdrucks, mit und ohne „ID:“, groß und klein, mit Leerzeichen", () => {
    for (const input of [
      "ff914420",
      "FF914420",
      "ID: ff914420",
      "id:ff914420",
      "  ff91 4420 ",
      "ID ff914420",
    ])
      expect(parseCardId(input)).toEqual({ scheibenId: -7_257_056, hex: "ff914420" })
    expect(parseCardId("0000002a")).toEqual({ scheibenId: 42, hex: "0000002a" })
    expect(parseCardId("7fffffff")?.scheibenId).toBe(2_147_483_647)
    expect(parseCardId("80000000")?.scheibenId).toBe(-2_147_483_648)
  })

  it("alles andere ist keine ID", () => {
    for (const input of [
      "",
      "ff91442",
      "ff9144200",
      "gg914420",
      "-7257056",
      "ID: ",
      "Seite: 1",
      "ff91-4420",
    ])
      expect(parseCardId(input)).toBeNull()
  })

  it("schreibt die ScheibenID wieder wie auf dem Ausdruck", () => {
    for (const id of [-7_257_056, 42, 2_147_483_647, -2_147_483_648, 0])
      expect(parseCardId(printedId(id))?.scheibenId).toBe(id)
    expect(printedId(-7_257_056)).toBe("ff914420")
  })
})

describe("eveningOfStart", () => {
  // Meyton schreibt Ortszeit; der grobe Beginn trägt sie als UTC (`startHintMs`)
  it("der Tag der Ortszeit, vor 4 Uhr der Vortag", () => {
    expect(eveningOfStart(Date.UTC(2026, 9, 21, 19, 12))).toBe("2026-10-21")
    expect(eveningOfStart(Date.UTC(2026, 9, 21, 23, 59))).toBe("2026-10-21")
    expect(eveningOfStart(Date.UTC(2026, 9, 22, 3, 59))).toBe("2026-10-21")
    expect(eveningOfStart(Date.UTC(2026, 9, 22, 4, 0))).toBe("2026-10-22")
    expect(eveningOfStart(Date.UTC(2026, 0, 1, 1, 0))).toBe("2025-12-31")
  })
})
