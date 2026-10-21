import { describe, expect, it } from "vitest"

import { contourPath } from "./contours"

/** die Punkte eines Pfads aus `contourPath`: Anfang und das Ende jedes Kurvenstücks */
const coordinates = (path: string) =>
  [...path.matchAll(/(?:M|L|C(?:-?[\d.]+ ){4})(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])

describe("contourPath", () => {
  it("eine Spitze in der Mitte: ein geschlossener Pfad um die Mitte, halb zwischen den Zellen", () => {
    const path = contourPath({ size: 3, cells: [0, 0, 0, 0, 255, 0, 0, 0, 0] }, 128, 1500)
    expect(path.match(/M/g)).toHaveLength(1)
    expect(path.endsWith("Z")).toBe(true)
    const points = coordinates(path)
    // vier Punkte, der letzte Bogen endet wieder am ersten
    expect(points).toHaveLength(5)
    for (const [x, y] of points) {
      expect(Math.hypot(x, y)).toBeGreaterThan(0.49)
      expect(Math.hypot(x, y)).toBeLessThan(0.51)
    }
  })

  it("ohne Fläche ein leerer Pfad", () => {
    expect(contourPath({ size: 2, cells: [0, 0, 0, 0] }, 1, 1000)).toBe("")
    expect(contourPath({ size: 2, cells: [10, 10, 10, 10] }, 11, 1000)).toBe("")
  })

  it("zwei getrennte Spitzen: zwei Teile", () => {
    const cells = [255, 0, 0, 0, 0, 0, 0, 0, 255]
    expect(contourPath({ size: 3, cells }, 128, 1500).match(/M/g)).toHaveLength(2)
  })

  it("Zeile 0 liegt oben: eine Spitze oben links liegt bei negativem y im SVG", () => {
    const points = coordinates(
      contourPath({ size: 3, cells: [255, 0, 0, 0, 0, 0, 0, 0, 0] }, 128, 1500)
    )
    for (const [x, y] of points) {
      expect(x).toBeLessThan(0)
      expect(y).toBeLessThan(0)
    }
  })

  it("das ganze Raster über der Stufe: eine Fläche um das Raster herum", () => {
    const path = contourPath({ size: 2, cells: [200, 200, 200, 200] }, 100, 1000)
    expect(path.match(/M/g)).toHaveLength(1)
    for (const [x, y] of coordinates(path)) {
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeGreaterThan(0.5)
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThan(1.5)
    }
  })
})
