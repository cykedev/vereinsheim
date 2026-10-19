import { describe, expect, it } from "vitest"

import {
  compareRange,
  DAY_MS,
  inRange,
  isoWeekKey,
  rangeDays,
  resolveRange,
  ROLLING_CHOICES,
  weekLabel,
  weekDate,
  weekStartIso,
  type NamedPeriod,
} from "./calendar"

const NOW = Date.UTC(2026, 8, 30, 10)
const TZ = "Europe/Berlin"
const NAMED: NamedPeriod[] = [
  { id: "lm", name: "Vorbereitung Landesmeisterschaft", from: "2026-05-01", to: "2026-06-30" },
  { id: "muni", name: "Neue Munition", from: "2026-08-01", to: null },
]
const context = { nowMs: NOW, timeZone: TZ, named: NAMED, firstMs: Date.UTC(2026, 3, 6, 16) }

describe("Zeiträume", () => {
  it("die rollenden Vorgaben", () => {
    expect(ROLLING_CHOICES.map((c) => c.label)).toEqual([
      "Letzte 30 Tage",
      "Letzte 90 Tage",
      "Letzte 6 Monate",
      "Letzte 12 Monate",
      "Alles",
    ])
  })

  it("rollend: Beginn nach now − N Tage, bis now", () => {
    const range = resolveRange({ type: "rolling", days: 90 }, context)
    expect(range).toEqual({ fromMs: NOW - 90 * DAY_MS, toMs: NOW + 1, label: "Letzte 90 Tage" })
    // sechs Monate: ein halbes Jahr zu 26 Wochen
    expect(resolveRange({ type: "rolling", days: 182 }, context)).toEqual({
      fromMs: NOW - 182 * DAY_MS,
      toMs: NOW + 1,
      label: "Letzte 6 Monate",
    })
  })

  it("alles: ab der ersten Scheibe, ohne Scheiben ab jetzt", () => {
    expect(resolveRange({ type: "all" }, context)).toEqual({
      fromMs: Date.UTC(2026, 3, 6, 16),
      toMs: NOW + 1,
      label: "Alles",
    })
    expect(resolveRange({ type: "all" }, { ...context, firstMs: null }).fromMs).toBe(NOW)
  })

  it("frei: vom Beginn des ersten bis zum Beginn des Tags nach dem letzten, in der Zeitzone", () => {
    const range = resolveRange({ type: "free", from: "2026-07-01", to: "2026-07-31" }, context)
    expect(range).toEqual({
      fromMs: Date.UTC(2026, 5, 30, 22),
      toMs: Date.UTC(2026, 6, 31, 22),
      label: "01.07.2026 – 31.07.2026",
    })
  })

  it("das Ende eines freien Zeitraums am Tag der Zeitumstellung ist der Beginn des nächsten Tags", () => {
    // der 25. Oktober hat 25 Stunden: der 26. beginnt um 23:00 UTC, nicht 24 h nach dem 25.
    const range = resolveRange({ type: "free", from: "2026-10-25", to: "2026-10-25" }, context)
    expect(range.toMs - range.fromMs).toBe(25 * 3_600_000)
  })

  it("benannt mit und ohne Ende", () => {
    expect(resolveRange({ type: "named", id: "lm" }, context)).toEqual({
      fromMs: Date.UTC(2026, 3, 30, 22),
      toMs: Date.UTC(2026, 5, 30, 22),
      label: "Vorbereitung Landesmeisterschaft",
    })
    expect(resolveRange({ type: "named", id: "muni" }, context)).toEqual({
      fromMs: Date.UTC(2026, 6, 31, 22),
      toMs: NOW + 1,
      label: "Neue Munition",
    })
  })

  it("ein unbekannter benannter Zeitraum fällt auf 90 Tage zurück", () => {
    expect(resolveRange({ type: "named", id: "weg" }, context).label).toBe("Letzte 90 Tage")
  })

  it("Vergleich: gleich lang direkt davor, ein benannter, keiner", () => {
    const range = resolveRange({ type: "rolling", days: 90 }, context)
    expect(compareRange({ type: "previous" }, range, context)).toEqual({
      fromMs: NOW - 180 * DAY_MS - 1,
      toMs: NOW - 90 * DAY_MS,
      label: "Zeitraum davor",
    })
    expect(compareRange({ type: "named", id: "lm" }, range, context)?.label).toBe(
      "Vorbereitung Landesmeisterschaft"
    )
    expect(compareRange({ type: "named", id: "weg" }, range, context)).toBeNull()
    expect(compareRange({ type: "none" }, range, context)).toBeNull()
  })

  it("erster und letzter Tag in Worten", () => {
    expect(rangeDays(resolveRange({ type: "rolling", days: 90 }, context), TZ)).toBe(
      "02.07.2026 – 30.09.2026"
    )
    expect(rangeDays(resolveRange({ type: "named", id: "lm" }, context), TZ)).toBe(
      "01.05.2026 – 30.06.2026"
    )
  })

  it("im Zeitraum: Anfang eingeschlossen, Ende nicht", () => {
    const range = { fromMs: 10, toMs: 20, label: "" }
    expect([9, 10, 19, 20].map((ms) => inRange(ms, range))).toEqual([false, true, true, false])
  })
})

describe("ISO-Wochen", () => {
  it("Woche nach ISO 8601, Montag bis Sonntag, Woche 1 mit dem ersten Donnerstag", () => {
    expect(isoWeekKey("2026-07-15")).toBe("2026-W29")
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01")
    expect(isoWeekKey("2026-12-28")).toBe("2026-W53")
    // 2026 beginnt an einem Donnerstag und hat 53 Wochen: der 1. Januar 2027 gehört noch dazu
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53")
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01")
    // Sonntag gehört zur Woche davor, Montag beginnt die neue
    expect(isoWeekKey("2026-07-19")).toBe("2026-W29")
    expect(isoWeekKey("2026-07-20")).toBe("2026-W30")
  })

  it("Montag einer ISO-Woche, auch über den Jahreswechsel", () => {
    expect(weekStartIso("2026-W27")).toBe("2026-06-29")
    expect(weekStartIso("2026-W01")).toBe("2025-12-29")
    expect(weekStartIso("2027-W01")).toBe("2027-01-04")
    expect(weekStartIso("2020-W53")).toBe("2020-12-28")
    for (const key of ["2026-W01", "2026-W27", "2026-W53", "2027-W01", "2020-W53"])
      expect(isoWeekKey(weekStartIso(key))).toBe(key)
  })

  it("Name der Woche ist ihr Montag, keine Kalenderwoche", () => {
    expect(weekLabel("2026-W27")).toBe("29.06.")
    expect(weekLabel("2026-W01")).toBe("29.12.")
    // mit Jahr für Lineal und Tabelle: „Alles“ reicht über Jahreswechsel
    expect(weekDate("2026-W01")).toBe("29.12.2025")
    expect(weekDate("2026-W27")).toBe("29.06.2026")
  })
})
