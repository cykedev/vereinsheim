import { describe, expect, it } from "vitest"

import { parsePdfDate, parseXmpDate } from "./pdfDate"

describe("parsePdfDate (Info-Dict)", () => {
  it("liest das Datum des Ausdrucks mit Zeitzone", () => {
    expect(parsePdfDate("D:20261002195212+02'00'")).toEqual({
      local: "2026-10-02T19:52:12",
      offsetMinutes: 120,
      epochMs: 1790963532000,
    })
  })

  it("verträgt fehlendes Schluss-Apostroph und fehlendes D:", () => {
    const expected = parsePdfDate("D:20261002195212+02'00'")
    expect(parsePdfDate("D:20261002195212+02'00")).toEqual(expected)
    expect(parsePdfDate("20261002195212+02'00'")).toEqual(expected)
    expect(parsePdfDate("  D:20261002195212+02'00'  ")).toEqual(expected)
  })

  it("Z ist UTC, negative Versätze mit Minuten", () => {
    expect(parsePdfDate("D:20261002195212Z")).toEqual({
      local: "2026-10-02T19:52:12",
      offsetMinutes: 0,
      epochMs: Date.UTC(2026, 9, 2, 19, 52, 12),
    })
    expect(parsePdfDate("D:20261002195212-05'30'")).toEqual({
      local: "2026-10-02T19:52:12",
      offsetMinutes: -330,
      epochMs: 1790990532000,
    })
  })

  it("ohne Zeitzone gibt es keinen absoluten Zeitpunkt", () => {
    expect(parsePdfDate("D:20261002195212")).toEqual({
      local: "2026-10-02T19:52:12",
      offsetMinutes: null,
      epochMs: null,
    })
  })

  it("fehlende Teile ergänzt die Norm (Monat und Tag 01, Uhrzeit 00)", () => {
    expect(parsePdfDate("D:2026")).toEqual({
      local: "2026-01-01T00:00:00",
      offsetMinutes: null,
      epochMs: null,
    })
    expect(parsePdfDate("D:202610021952")?.local).toBe("2026-10-02T19:52:00")
  })

  it("ohne Uhrzeit kein Versatz und kein absoluter Zeitpunkt", () => {
    expect(parsePdfDate("D:2026Z")).toEqual({
      local: "2026-01-01T00:00:00",
      offsetMinutes: null,
      epochMs: null,
    })
    expect(parsePdfDate("D:20261002+02'00'")?.epochMs).toBeNull()
  })

  it("Jahre vor 1970 gibt es nicht; Z mit Versatz ist ein Widerspruch", () => {
    expect(parsePdfDate("D:00991231120000Z")).toBeNull()
    expect(parsePdfDate("D:19691231235959Z")).toBeNull()
    expect(parsePdfDate("D:19700101000000Z")?.epochMs).toBe(0)
    expect(parsePdfDate("D:20261002195212Z05'00'")).toBeNull()
    expect(parsePdfDate("D:20261002195212Z00'00'")?.offsetMinutes).toBe(0)
  })

  it("Schaltjahr: der 29. Februar 2024 gilt", () => {
    expect(parsePdfDate("D:20240229120000Z")?.local).toBe("2024-02-29T12:00:00")
  })

  it("ungültige Daten ergeben keine Zeit", () => {
    for (const raw of [
      "D:20261302195212+02'00'",
      "D:20260230120000Z",
      "D:20250229120000Z",
      "D:20261002245212Z",
      "D:20261002196012Z",
      "D:20261002195260Z",
      "D:20261002195212+15'00'",
      "D:20261002195212+02'60'",
      "Meyton",
      "",
    ]) {
      expect(parsePdfDate(raw), raw).toBeNull()
    }
  })
})

describe("parseXmpDate (xmp:CreateDate)", () => {
  it("liest ISO 8601 mit Zeitzone", () => {
    expect(parseXmpDate("2026-08-11T18:29:54+02:00")).toEqual({
      local: "2026-08-11T18:29:54",
      offsetMinutes: 120,
      epochMs: 1786465794000,
    })
  })

  it("Sekundenbruchteile fallen weg, Z ist UTC", () => {
    expect(parseXmpDate("2026-08-11T18:29:54.123Z")).toEqual({
      local: "2026-08-11T18:29:54",
      offsetMinutes: 0,
      epochMs: Date.UTC(2026, 7, 11, 18, 29, 54),
    })
  })

  it("nur ein Tag: Mitternacht, ohne Zeitzone", () => {
    expect(parseXmpDate("2026-08-11")).toEqual({
      local: "2026-08-11T00:00:00",
      offsetMinutes: null,
      epochMs: null,
    })
  })

  it("eine Zeitzone gilt nur mit Uhrzeit", () => {
    expect(parseXmpDate("2026-08-11+02:00")).toBeNull()
  })

  it("Uhrzeit ohne Sekunden", () => {
    expect(parseXmpDate("2026-08-11T18:29+02:00")?.local).toBe("2026-08-11T18:29:00")
  })

  it("ungültige Daten ergeben keine Zeit", () => {
    for (const raw of [
      "2026-13-01T00:00:00Z",
      "2026-02-30T00:00:00Z",
      "2026-08-11T24:00:00Z",
      "2026-08-11T18:29:54+14:30",
      "11.08.2026",
      "",
    ]) {
      expect(parseXmpDate(raw), raw).toBeNull()
    }
  })
})
