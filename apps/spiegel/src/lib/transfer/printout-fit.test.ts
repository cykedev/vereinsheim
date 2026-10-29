import { describe, expect, it } from "vitest"

import type { PrintoutReading } from "@vereinsheim/meyton-pdf/reading"

import { printoutFits } from "./printout-fit"

const ZONE = "Europe/Berlin"

// 40 Schuss mit 382 Ringen und 3906 Zehnteln: die beiden Wertungen sind nicht ineinander umzurechnen
const reading = (over: Partial<PrintoutReading> = {}): PrintoutReading =>
  ({
    probe: false,
    shots: Array.from({ length: 40 }, () => ({ series: 1, decimalTenths: 98, innerTen: false })),
    total: { rings: 382, decimalTenths: 3906 },
    ...over,
  }) as PrintoutReading

const printout = (
  over: { reading?: PrintoutReading | null; status?: "ok" | "inconsistent"; printedAt?: Date } = {}
) => ({
  // 19:30 in Berlin
  printedAt: over.printedAt ?? new Date("2026-03-13T18:30:00Z"),
  values: {
    status: over.status ?? ("ok" as const),
    reading: over.reading === undefined ? reading() : over.reading,
  },
})

const unit = (over: Partial<Parameters<typeof printoutFits>[1]> = {}) => ({
  day: "2026-03-13",
  scoring: "WHOLE" as const,
  shots: 40,
  total: { rings: 382 },
  ...over,
})

describe("printoutFits", () => {
  it("passt in ganzen Ringen und in Zehnteln", () => {
    expect(printoutFits(printout(), unit(), ZONE)).toBe(true)
    expect(
      printoutFits(printout(), unit({ scoring: "TENTH", total: { decimalTenths: 3906 } }), ZONE)
    ).toBe(true)
  })

  it("anderes Ergebnis in der Wertung von Treffsicher passt nicht", () => {
    expect(printoutFits(printout(), unit({ total: { rings: 381 } }), ZONE)).toBe(false)
    // in Zehnteln zählen die Zehntel, nicht die Ringe
    expect(
      printoutFits(printout(), unit({ scoring: "TENTH", total: { decimalTenths: 3820 } }), ZONE)
    ).toBe(false)
    // in ganzen Ringen zählen die Ringe
    expect(printoutFits(printout(), unit({ total: { rings: 390 } }), ZONE)).toBe(false)
  })

  it("andere Schusszahl passt nicht", () => {
    expect(printoutFits(printout(), unit({ shots: 30 }), ZONE)).toBe(false)
  })

  it("anderer Abend passt nicht; nach Mitternacht vor 4 Uhr ist noch derselbe", () => {
    expect(printoutFits(printout(), unit({ day: "2026-03-12" }), ZONE)).toBe(false)
    const late = printout({ printedAt: new Date("2026-03-14T01:30:00Z") })
    expect(printoutFits(late, unit(), ZONE)).toBe(true)
  })

  it("ohne gelesene Werte, nur Probe oder ohne Ergebnis in Treffsicher passt nichts", () => {
    expect(printoutFits(printout({ status: "inconsistent" }), unit(), ZONE)).toBe(false)
    expect(printoutFits(printout({ reading: null }), unit(), ZONE)).toBe(false)
    expect(
      printoutFits(printout({ reading: reading({ probe: true, total: null }) }), unit(), ZONE)
    ).toBe(false)
    expect(printoutFits(printout(), unit({ total: null }), ZONE)).toBe(false)
    expect(printoutFits(printout(), unit({ total: {} }), ZONE)).toBe(false)
  })
})
