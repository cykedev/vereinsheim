import { describe, expect, it } from "vitest"

import { sessionRingDistribution } from "@/lib/sessions/ringDistribution"

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
