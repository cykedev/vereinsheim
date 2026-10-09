import { describe, expect, it } from "vitest"

import { DEFAULT_CHOICE, type PeriodChoice } from "../period/calendar"
import { decodeChoice, decodeCompare, encodeChoice, encodeCompare } from "./routes"

describe("Zeitraum und Vergleich als Wert (D4)", () => {
  it("rollend, alles, frei und benannt in beide Richtungen", () => {
    const cases: [PeriodChoice, string][] = [
      [{ type: "rolling", days: 30 }, "30d"],
      [{ type: "rolling", days: 90 }, "90d"],
      [{ type: "rolling", days: 365 }, "12m"],
      [{ type: "all" }, "all"],
      [{ type: "free", from: "2026-05-01", to: "2026-06-30" }, "2026-05-01..2026-06-30"],
      [{ type: "named", id: "neue-munition" }, "neue-munition"],
    ]
    for (const [choice, text] of cases) {
      expect(encodeChoice(choice)).toBe(text)
      expect(decodeChoice(text, DEFAULT_CHOICE)).toEqual(choice)
    }
  })

  it("ein freier Zeitraum nur mit echten Tagen in der richtigen Reihenfolge, auch ein einzelner Tag", () => {
    expect(decodeChoice("2026-02-30..2026-03-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-06-30..2026-05-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-6-1..2026-06-30", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2028-02-29..2028-02-29", DEFAULT_CHOICE)).toEqual({
      type: "free",
      from: "2028-02-29",
      to: "2028-02-29",
    })
  })

  it("ein benannter Zeitraum nur als Id; die festen Werte gehen vor", () => {
    expect(decodeChoice("Neue Munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("-munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("all", DEFAULT_CHOICE)).toEqual({ type: "all" })
    expect(decodeChoice("12m", DEFAULT_CHOICE)).toEqual({ type: "rolling", days: 365 })
  })

  it("ohne Wert oder mit leerem Wert gilt die Vorgabe, auch null", () => {
    expect(decodeChoice(null, DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice(null, null)).toBeNull()
    expect(decodeChoice("7 Tage", null)).toBeNull()
    // „7d“ ist kein fester Wert, aber eine gültige Id eines benannten Zeitraums
    expect(decodeChoice("7d", null)).toEqual({ type: "named", id: "7d" })
  })

  it("Vergleich: ohne, der Zeitraum davor oder ein benannter", () => {
    expect(encodeCompare({ type: "none" })).toBeNull()
    expect(encodeCompare({ type: "previous" })).toBe("previous")
    expect(encodeCompare({ type: "named", id: "saison-2025" })).toBe("saison-2025")
    expect(decodeCompare(null)).toEqual({ type: "none" })
    expect(decodeCompare("previous")).toEqual({ type: "previous" })
    expect(decodeCompare("saison-2025")).toEqual({ type: "named", id: "saison-2025" })
    expect(decodeCompare("Saison 2025")).toEqual({ type: "none" })
  })
})
