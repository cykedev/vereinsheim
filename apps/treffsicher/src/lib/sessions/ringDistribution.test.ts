import { describe, expect, it } from "vitest"

import { periodRingDistribution, sessionRingDistribution } from "@/lib/sessions/ringDistribution"

describe("Ringverteilung einer Einheit", () => {
  it("je Schuss der ganze Ring, Zehntel abgerundet, Unlesbares zählt nicht", () => {
    const dist = sessionRingDistribution(["10.3", "9.9", "9,0", "8.1", "10", "x", "7", "0"])
    expect(dist.n).toBe(7)
    expect(dist.counts[10]).toBe(2)
    expect(dist.counts[9]).toBe(2)
    expect(dist.counts[8]).toBe(1)
    expect(dist.counts[7]).toBe(1)
    expect(dist.counts[0]).toBe(1)
    expect(dist.innerTens).toBe(0)
  })

  it("ohne Schüsse leer", () => {
    expect(sessionRingDistribution([]).n).toBe(0)
  })
})

describe("Ringverteilung über mehrere Einheiten", () => {
  it("alle Wertungsschüsse zusammen, ohne Probe", () => {
    const { dist, sessions } = periodRingDistribution([
      {
        series: [
          { isPractice: true, shots: ["10.9", "10.9"] },
          { isPractice: false, shots: ["9.5", "10.1"] },
        ],
      },
      {
        series: [
          { isPractice: false, shots: ["8.0"] },
          { isPractice: false, shots: null },
        ],
      },
    ])
    expect(dist.n).toBe(3)
    expect([dist.counts[10], dist.counts[9], dist.counts[8]]).toEqual([1, 1, 1])
    expect(sessions).toBe(2)
    // eine Einheit ohne Einzelschüsse trägt nichts bei und zählt nicht
    expect(
      periodRingDistribution([
        { series: [{ isPractice: false, shots: ["9.5"] }] },
        { series: [{ isPractice: false, shots: null }] },
      ]).sessions
    ).toBe(1)
  })
})
