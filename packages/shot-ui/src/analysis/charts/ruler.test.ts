import { describe, expect, it } from "vitest"

import { nearestIndex, stepIndex, toSvgX } from "./ruler"

describe("Lineal: reine Funktionen", () => {
  it("nächster Wert zu einer x-Position, bei Gleichstand der frühere", () => {
    expect(nearestIndex([10, 20, 30], 24)).toBe(1)
    expect(nearestIndex([10, 20, 30], 25)).toBe(1)
    expect(nearestIndex([10, 20, 30], 26)).toBe(2)
    expect(nearestIndex([10, 20, 30], -100)).toBe(0)
    expect(nearestIndex([10, 20, 30], 900)).toBe(2)
    expect(nearestIndex([], 5)).toBeNull()
  })

  it("Schritte mit der Tastatur: ±1 in den Grenzen, an den Rand, ohne Wahl von außen herein", () => {
    expect(stepIndex(null, 1, 5)).toBe(0)
    expect(stepIndex(null, -1, 5)).toBe(4)
    expect(stepIndex(2, 1, 5)).toBe(3)
    expect(stepIndex(4, 1, 5)).toBe(4)
    expect(stepIndex(0, -1, 5)).toBe(0)
    expect(stepIndex(2, -Infinity, 5)).toBe(0)
    expect(stepIndex(2, Infinity, 5)).toBe(4)
    expect(stepIndex(null, 1, 0)).toBeNull()
  })

  it("x im SVG aus der Bildschirmposition, auch wenn das SVG skaliert ist", () => {
    expect(toSvgX(150, { left: 50, width: 300 }, 600)).toBe(200)
    expect(toSvgX(50, { left: 50, width: 300 }, 600)).toBe(0)
    expect(toSvgX(80, { left: 50, width: 0 }, 600)).toBe(30)
  })
})
