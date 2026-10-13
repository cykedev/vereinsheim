import { describe, expect, it } from "vitest"

import {
  APP_LOCALE,
  formatDateOnly,
  formatDateTime,
  formatDateTimeSeconds,
  formatInteger,
  formatNumber,
  formatIsoDate,
  formatLongDateTime,
  formatMonthShort,
  formatMonthYear,
  formatShortDate,
  formatShortDay,
  formatTimeOfDay,
  formatWeekdayDate,
  formatWeekdayDay,
  zonedDayStartMs,
  zonedWallTimeMs,
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

describe("formatNumber", () => {
  it("behaelt Dezimalstellen und nutzt deutsche Trenner", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5")
    expect(formatNumber(96.3)).toBe("96,3")
    expect(formatNumber(1000)).toBe("1.000")
  })

  it("haengt nicht an der Locale des Browsers", () => {
    // Der Wert ist unabhaengig von navigator.language / System-Locale.
    expect(formatNumber(1234.5)).not.toBe("1,234.5")
  })
})

describe("formatMonthShort und formatMonthYear", () => {
  const july = new Date(Date.UTC(2026, 6, 15, 12))
  it("kurzer und langer Monat in der Zielzeitzone", () => {
    expect(formatMonthShort(july, "Europe/Berlin")).toBe("Jul")
    expect(formatMonthShort(new Date(Date.UTC(2026, 8, 15, 12)), "Europe/Berlin")).toBe("Sep")
    expect(formatMonthYear(july, "Europe/Berlin")).toBe("Juli 2026")
  })
  it("der Monatswechsel folgt der Zeitzone", () => {
    // 31.07., 22:30 UTC ist in Berlin schon der 1. August
    const edge = new Date(Date.UTC(2026, 6, 31, 22, 30))
    expect(formatMonthShort(edge, "Europe/Berlin")).toBe("Aug")
    expect(formatMonthShort(edge, "UTC")).toBe("Jul")
  })
})

describe("zonedDayStartMs", () => {
  it("Beginn des Kalendertags in Sommer- und Winterzeit", () => {
    expect(zonedDayStartMs("2026-07-15", "Europe/Berlin")).toBe(Date.UTC(2026, 6, 14, 22))
    expect(zonedDayStartMs("2026-01-15", "Europe/Berlin")).toBe(Date.UTC(2026, 0, 14, 23))
  })
  it("am Tag der Zeitumstellung beginnt der Tag in der Zeit davor", () => {
    expect(zonedDayStartMs("2026-03-29", "Europe/Berlin")).toBe(Date.UTC(2026, 2, 28, 23))
    expect(zonedDayStartMs("2026-10-25", "Europe/Berlin")).toBe(Date.UTC(2026, 9, 24, 22))
  })
  it("in UTC Mitternacht UTC", () => {
    expect(zonedDayStartMs("2026-07-15", "UTC")).toBe(Date.UTC(2026, 6, 15))
  })
  it("kein gültiger Tag: Fehler", () => {
    expect(() => zonedDayStartMs("2026-7-15", "UTC")).toThrow(RangeError)
  })
})

describe("formatWeekdayDay (Spiegel, Datum in der Scheiben-Liste unter dem Monat)", () => {
  it("Wochentag kurz ohne Punkt, Tag und Monat ohne Jahr, in der Zeitzone", () => {
    expect(formatWeekdayDay(new Date(Date.UTC(2026, 8, 26, 10)), "Europe/Berlin")).toBe("Sa 26.09.")
    expect(formatWeekdayDay(CROSSES_MIDNIGHT, "Europe/Berlin")).toBe("Mi 09.09.")
  })
})

describe("formatWeekdayDate und formatTimeOfDay (Spiegel, Abende der Scheiben-Liste)", () => {
  it("Wochentag kurz ohne Punkt, Datum mit Jahr, in der Zeitzone", () => {
    // 29.09.2026 ist ein Dienstag; 23:30 UTC ist in Berlin schon Mittwoch
    expect(formatWeekdayDate(new Date(Date.UTC(2026, 8, 29, 10)), "Europe/Berlin")).toBe(
      "Di 29.09.2026"
    )
    expect(formatWeekdayDate(new Date(Date.UTC(2026, 8, 29, 23, 30)), "Europe/Berlin")).toBe(
      "Mi 30.09.2026"
    )
    expect(formatWeekdayDate(new Date(Date.UTC(2026, 8, 29, 23, 30)), "UTC")).toBe("Di 29.09.2026")
  })
  it("Uhrzeit in Stunden und Minuten, in der Zeitzone", () => {
    expect(formatTimeOfDay(new Date(Date.UTC(2026, 8, 29, 16, 30)), "Europe/Berlin")).toBe("18:30")
    expect(formatTimeOfDay(new Date(Date.UTC(2026, 8, 29, 22, 30)), "Europe/Berlin")).toBe("00:30")
  })
})

describe("zonedWallTimeMs", () => {
  const wall = (y: number, mo: number, d: number, h: number, mi = 0, sec = 0, ms = 0) =>
    Date.UTC(y, mo - 1, d, h, mi, sec, ms)

  it("Sommer- und Winterzeit in Berlin, Millisekunden bleiben", () => {
    expect(zonedWallTimeMs(wall(2026, 10, 9, 19, 5, 41, 381), "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 9, 17, 5, 41, 381)
    )
    expect(zonedWallTimeMs(wall(2026, 1, 15, 19), "Europe/Berlin")).toBe(Date.UTC(2026, 0, 15, 18))
    expect(zonedWallTimeMs(wall(2026, 7, 1, 12), "UTC")).toBe(Date.UTC(2026, 6, 1, 12))
  })

  it("doppelte Stunde im Herbst: die frühere (noch Sommerzeit)", () => {
    // 25. Oktober 2026: 03:00 MESZ wird 02:00 MEZ; 02:30 gibt es zweimal (00:30 und 01:30 UTC)
    expect(zonedWallTimeMs(wall(2026, 10, 25, 2, 30), "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 25, 0, 30)
    )
    expect(zonedWallTimeMs(wall(2026, 10, 25, 3, 30), "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 25, 2, 30)
    )
  })

  it("ausgefallene Stunde im Frühjahr: hinter der Lücke", () => {
    // 29. März 2026: 02:00 MEZ wird 03:00 MESZ; 02:30 gibt es nicht und gilt als 03:30 MESZ (01:30 UTC)
    expect(zonedWallTimeMs(wall(2026, 3, 29, 2, 30), "Europe/Berlin")).toBe(
      Date.UTC(2026, 2, 29, 1, 30)
    )
    expect(zonedWallTimeMs(wall(2026, 3, 29, 1, 59), "Europe/Berlin")).toBe(
      Date.UTC(2026, 2, 29, 0, 59)
    )
  })
})
