import { describe, expect, it } from "vitest"

import { safeCallback } from "./callback"

describe("safeCallback", () => {
  const origin = "http://localhost:3002"
  it("Pfade dieser App bleiben", () => {
    expect(safeCallback("/cards?family=lp-freihand#2026-10-09", origin)).toBe(
      "/cards?family=lp-freihand#2026-10-09"
    )
    expect(safeCallback("http://localhost:3002/cards/abc?from=list", origin)).toBe(
      "/cards/abc?from=list"
    )
  })
  it("fremde Herkunft, protokollrelativ oder leer: Start", () => {
    expect(safeCallback("https://example.com/", origin)).toBe("/")
    expect(safeCallback("//example.com/x", origin)).toBe("/")
    expect(safeCallback("/\\example.com", origin)).toBe("/")
    expect(safeCallback("javascript:alert(1)", origin)).toBe("/")
    // Tab, Zeilenumbruch: der Parser entfernt sie, aus „/\t/x“ wird „//x“
    expect(safeCallback("/\t/evil.com", origin)).toBe("/")
    expect(safeCallback("/\n/evil.com", origin)).toBe("/")
    expect(safeCallback("/\r\n/evil.com", origin)).toBe("/")
    expect(safeCallback(undefined, origin)).toBe("/")
    expect(safeCallback("http://localhost:3002/x", undefined)).toBe("/")
    // ohne bekannte Herkunft bleiben Pfade dieser App
    expect(safeCallback("/cards", undefined)).toBe("/cards")
  })
})
