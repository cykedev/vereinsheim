import { describe, expect, it } from "vitest"

import { locationText, sideText, tickDecimals } from "@/lib/statistics/locationText"

describe("Trefferlage in Worten", () => {
  it("Richtung aus dem Vorzeichen, auf null mittig", () => {
    expect(locationText({ xMm: 0.4, yMm: -0.2 })).toBe("0,40 mm rechts und 0,20 mm tief")
    expect(locationText({ xMm: -1.25, yMm: 0.004 })).toBe("1,25 mm links und senkrecht mittig")
    expect(sideText(0.001, "x")).toBe("waagrecht mittig")
  })

  it("Achsen zeigen jede Stufe genau", () => {
    expect([1, 2, 0.5, 0.25, 0.2].map(tickDecimals)).toEqual([0, 0, 1, 2, 1])
  })
})
