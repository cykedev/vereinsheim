import { describe, expect, it } from "vitest"

import { mmToUm } from "./units"

describe("mmToUm", () => {
  it("rechnet Maße der Sportordnung in ganze Mikrometer um", () => {
    expect(mmToUm(4.5)).toBe(4500)
    expect(mmToUm(0.25)).toBe(250)
    expect(mmToUm(155.5)).toBe(155500)
  })

  it("lehnt Maße ab, die kein ganzes Mikrometer ergeben", () => {
    expect(() => mmToUm(0.0001)).toThrow(RangeError)
  })

  it("lehnt Werte ab, die keine Zahl sind", () => {
    expect(() => mmToUm(Number.NaN)).toThrow(RangeError)
    expect(() => mmToUm(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
