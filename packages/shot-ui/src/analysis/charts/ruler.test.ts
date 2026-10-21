import { describe, expect, it } from "vitest"

import { nearestIndex, SAME_X_PX, stepIndex, toSvgX, toSvgY } from "./ruler"

describe("Lineal: reine Funktionen", () => {
  it("nächster Wert zu einer x-Position, bei Gleichstand der frühere", () => {
    expect(nearestIndex([10, 20, 30], 24)).toBe(1)
    expect(nearestIndex([10, 20, 30], 25)).toBe(1)
    expect(nearestIndex([10, 20, 30], 26)).toBe(2)
    expect(nearestIndex([10, 20, 30], -100)).toBe(0)
    expect(nearestIndex([10, 20, 30], 900)).toBe(2)
    expect(nearestIndex([], 5)).toBeNull()
  })

  it("Werte fast übereinander: mit Höhen gewinnt der nach y nächste", () => {
    // drei Punkte im Abstand von 0,3 px: ohne Höhen der nach x nächste, mit Höhen der getroffene
    expect(nearestIndex([100, 100.3, 100.6], 100.5)).toBe(2)
    expect(nearestIndex([100, 100.3, 100.6], 100.5, [20, 50, 80], 52)).toBe(1)
    expect(nearestIndex([100, 100.3, 100.6], 100.5, [20, 50, 80], 10)).toBe(0)
    // weiter als SAME_X_PX auseinander: x geht vor, auch wenn der andere in der Höhe näher liegt
    expect(SAME_X_PX).toBe(4)
    expect(nearestIndex([100, 110], 101, [80, 20], 20)).toBe(0)
    expect(nearestIndex([100, 104], 101, [80, 20], 20)).toBe(1)
    // Gleichstand in y: der frühere
    expect(nearestIndex([100, 101], 100.5, [40, 60], 50)).toBe(0)
    // ohne y wie ohne Höhen
    expect(nearestIndex([100, 100.3, 100.6], 100.5, [20, 50, 80])).toBe(2)
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

  it("y im SVG mit demselben Maßstab wie x", () => {
    expect(toSvgY(150, { top: 50, width: 300 }, 600)).toBe(200)
    expect(toSvgY(80, { top: 50, width: 0 }, 600)).toBe(30)
  })
})
