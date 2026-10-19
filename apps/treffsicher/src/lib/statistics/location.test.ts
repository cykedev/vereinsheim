import { describe, expect, it } from "vitest"

import { locationSummary } from "@/lib/statistics/location"

const DAY = 86_400_000

describe("Trefferlage über den Zeitraum", () => {
  it("nur Einheiten mit Lage, in zeitlicher Folge, mit Mittel und Verlauf je Achse", () => {
    const summary = locationSummary([
      { id: "c", startedAtMs: 3 * DAY, location: { xMm: 0.6, yMm: -0.2 } },
      { id: "a", startedAtMs: 1 * DAY, location: { xMm: 0.2, yMm: 0.4 } },
      { id: "ohne", startedAtMs: 2 * DAY, location: null },
      { id: "b", startedAtMs: 2 * DAY, location: { xMm: -0.2, yMm: 0.1 } },
    ])
    expect(summary.points.map((p) => p.id)).toEqual(["a", "b", "c"])
    expect(summary.mean?.xMm).toBeCloseTo(0.2, 10)
    expect(summary.mean?.yMm).toBeCloseTo(0.1, 10)
    expect(summary.course.x.map((p) => p.value)).toEqual([0.2, -0.2, 0.6])
    // der Schnitt bis hierher: nach zwei Einheiten 0, nach dreien 0,2
    expect(summary.course.x[1].mean).toBeCloseTo(0, 10)
    expect(summary.course.x[2].mean).toBeCloseTo(0.2, 10)
    expect(summary.course.y.map((p) => p.value)).toEqual([0.4, 0.1, -0.2])
  })

  it("ohne Lage leer", () => {
    expect(locationSummary([{ id: "a", startedAtMs: 0, location: null }])).toEqual({
      points: [],
      mean: null,
      course: { x: [], y: [] },
    })
  })
})
