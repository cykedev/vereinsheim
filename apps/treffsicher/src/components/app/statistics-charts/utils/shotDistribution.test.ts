import { describe, it, expect } from "vitest"
import type { ShotDistributionPoint } from "@/lib/stats/actions"
import { buildShotDistributionTimeline } from "./shotDistribution"

const TZ = "Europe/Berlin"

function point(overrides: Partial<ShotDistributionPoint>): ShotDistributionPoint {
  return {
    date: new Date("2026-09-01T10:00:00Z"),
    sessionId: "s1",
    disciplineId: null,
    totalShots: 40,
    r0: 0,
    r1: 0,
    r2: 0,
    r3: 0,
    r4: 0,
    r5: 0,
    r6: 5,
    r7: 10,
    r8: 20,
    r9: 30,
    r10: 35,
    ...overrides,
  }
}

describe("buildShotDistributionTimeline", () => {
  it("zwei Einheiten am selben Tag bleiben zwei Punkte mit ihren eigenen Werten", () => {
    const result = buildShotDistributionTimeline(
      [
        point({ sessionId: "morning", date: new Date("2026-09-01T07:00:00Z"), r10: 20, r9: 45 }),
        point({ sessionId: "evening", date: new Date("2026-09-01T17:00:00Z"), r10: 60, r9: 5 }),
      ],
      TZ
    )

    expect(result).toHaveLength(2)
    expect(result.map((p) => p.sessionId)).toEqual(["morning", "evening"])
    expect(result.map((p) => p.r10)).toEqual([20, 60])
    expect(result.map((p) => p.r9)).toEqual([45, 5])
  })

  it("sortiert chronologisch und nummeriert fortlaufend", () => {
    const result = buildShotDistributionTimeline(
      [
        point({ sessionId: "c", date: new Date("2026-09-03T10:00:00Z") }),
        point({ sessionId: "a", date: new Date("2026-09-01T10:00:00Z") }),
        point({ sessionId: "b", date: new Date("2026-09-02T10:00:00Z") }),
      ],
      TZ
    )

    expect(result.map((p) => p.sessionId)).toEqual(["a", "b", "c"])
    expect(result.map((p) => p.i)).toEqual([0, 1, 2])
  })

  it("lässt Einheiten ohne Schuss weg", () => {
    const result = buildShotDistributionTimeline(
      [point({ sessionId: "empty", totalShots: 0 }), point({ sessionId: "full" })],
      TZ
    )

    expect(result.map((p) => p.sessionId)).toEqual(["full"])
  })

  it("füllt das Band 0–6 auf 100 % auf", () => {
    const [result] = buildShotDistributionTimeline(
      [point({ r7: 10.2, r8: 20.1, r9: 30.3, r10: 25.1 })],
      TZ
    )

    expect(result.r0to6).toBe(14.3)
  })

  it("beschriftet in der Anzeige-Zeitzone mit Uhrzeit und Schusszahl", () => {
    const [result] = buildShotDistributionTimeline(
      [point({ date: new Date("2026-09-08T22:30:00Z"), totalShots: 40 })],
      TZ
    )

    expect(result.dateLabel).toBe("09.09.26")
    expect(result.tooltipLabel).toBe("09.09.2026, 00:30 · 40 Schuss")
  })
})
