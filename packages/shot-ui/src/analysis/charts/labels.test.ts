import { describe, expect, it } from "vitest"

import { placeLabels } from "./labels"

describe("Beschriftungen ohne Überlappung", () => {
  const box = (x: number, y: number) => ({ x, y, width: 16 })

  it("freie Beschriftungen bleiben auf ihrem Punkt", () => {
    expect(placeLabels([box(10, 10), box(40, 10), box(10, 40)], 14)).toEqual([
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 10, y: 40 },
    ])
  })

  it("an derselben Stelle: die spätere rückt eine Zeile nach unten, die dritte nach oben", () => {
    expect(placeLabels([box(50, 50), box(50, 50), box(52, 49)], 14)).toEqual([
      { x: 50, y: 50 },
      { x: 50, y: 64 },
      { x: 52, y: 35 },
    ])
  })

  it("knapp nebeneinander gilt als überlappend, eine Breite daneben nicht", () => {
    expect(placeLabels([box(50, 50), box(65, 52)], 14)[1]).toEqual({ x: 65, y: 66 })
    expect(placeLabels([box(50, 50), box(66, 52)], 14)[1]).toEqual({ x: 66, y: 52 })
  })

  it("ist alles belegt, bleibt sie auf dem Punkt", () => {
    const crowd = Array.from({ length: 8 }, () => box(50, 50))
    const placed = placeLabels(crowd, 14)
    expect(placed.slice(0, 7).map((p) => p.y)).toEqual([50, 64, 36, 78, 22, 92, 8])
    expect(placed[7]).toEqual({ x: 50, y: 50 })
  })
})
