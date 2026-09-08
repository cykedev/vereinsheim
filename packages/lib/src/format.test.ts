import { describe, expect, it } from "vitest"

import {
  APP_LOCALE,
  formatDateOnly,
  formatDateTime,
  formatDateTimeSeconds,
  formatInteger,
  formatIsoDate,
  formatLongDateTime,
  formatShortDate,
  formatCompactMonthYear,
  formatShortDay,
} from "./format"

// 2026-09-08T22:30:00Z ist in Europe/Berlin (UTC+2) bereits der 09.09.2026, 00:30.
// Genau dieser Fall war der Bug: ohne uebergebene Zeitzone formatiert der Container
// (TZ=UTC) den Vortag.
const CROSSES_MIDNIGHT = new Date("2026-09-08T22:30:00Z")

describe("APP_LOCALE", () => {
  it("ist de-DE — eine Locale fuer beide Apps", () => {
    expect(APP_LOCALE).toBe("de-DE")
  })
})

describe("formatDateOnly", () => {
  it("nimmt die uebergebene Zeitzone und nicht die des Prozesses", () => {
    expect(formatDateOnly(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("09.09.2026")
    expect(formatDateOnly(CROSSES_MIDNIGHT, "UTC")).toBe("08.09.2026")
  })

  it("formatiert zweistellig mit Punkten", () => {
    expect(formatDateOnly(new Date("2026-01-05T12:00:00Z"), "Europe/Berlin")).toBe("05.01.2026")
  })
})

describe("formatDateTime", () => {
  it("haengt Uhrzeit in der Zielzeitzone an", () => {
    expect(formatDateTime(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("09.09.2026, 00:30")
    expect(formatDateTime(CROSSES_MIDNIGHT, "UTC")).toBe("08.09.2026, 22:30")
  })
})

describe("formatDateTimeSeconds", () => {
  it("zeigt zusaetzlich Sekunden", () => {
    expect(formatDateTimeSeconds(new Date("2026-09-08T12:34:56Z"), "Europe/Berlin")).toBe(
      "08.09.2026, 14:34:56"
    )
  })
})

describe("formatLongDateTime", () => {
  it("nennt Wochentag und Monat ausgeschrieben", () => {
    const result = formatLongDateTime(CROSSES_MIDNIGHT, "Europe/Berlin")
    expect(result).toContain("Mittwoch")
    expect(result).toContain("September")
    expect(result).toContain("00:30")
  })
})

describe("formatShortDay", () => {
  it("gibt Tag und Monat fuer Diagramm-Achsen", () => {
    expect(formatShortDay(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("09.09.")
  })
})

describe("formatShortDate", () => {
  it("kuerzt das Jahr fuer Diagramm-Achsen", () => {
    expect(formatShortDate(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("09.09.26")
  })
})

describe("formatCompactMonthYear", () => {
  it("gibt Monat und Kurzjahr", () => {
    expect(formatCompactMonthYear(new Date("2026-09-15T12:00:00Z"), "Europe/Berlin")).toBe("09.26")
  })
})

describe("formatIsoDate", () => {
  it("gibt ein sortierbares Datum in der Zielzeitzone", () => {
    expect(formatIsoDate(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("2026-09-09")
    expect(formatIsoDate(CROSSES_MIDNIGHT, "UTC")).toBe("2026-09-08")
  })
})

describe("formatInteger", () => {
  it("setzt den deutschen Tausenderpunkt", () => {
    expect(formatInteger(1234)).toBe("1.234")
    expect(formatInteger(1234567)).toBe("1.234.567")
    expect(formatInteger(0)).toBe("0")
  })

  it("rundet auf ganze Zahlen", () => {
    expect(formatInteger(12.6)).toBe("13")
  })
})
