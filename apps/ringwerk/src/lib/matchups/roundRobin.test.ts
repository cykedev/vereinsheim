import { describe, expect, it } from "vitest"
import { roundRobinRounds } from "./roundRobin"

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i}`)
}

/** A minus B per participant, counting real duels only (byes carry no side). */
function sideBalance(n: number): Map<string, number> {
  const balance = new Map(ids(n).map((id) => [id, 0]))
  for (const m of roundRobinRounds(ids(n))) {
    if (m.awayId === null) continue
    balance.set(m.homeId, balance.get(m.homeId)! + 1)
    balance.set(m.awayId, balance.get(m.awayId)! - 1)
  }
  return balance
}

const SIZES = Array.from({ length: 15 }, (_, i) => i + 2) // 2 … 16

describe("roundRobinRounds", () => {
  it("returns nothing for fewer than two participants", () => {
    expect(roundRobinRounds([])).toEqual([])
    expect(roundRobinRounds(["p0"])).toEqual([])
  })

  it.each(SIZES)("%i participants: every pair meets exactly once", (n) => {
    const pairs = roundRobinRounds(ids(n))
      .filter((m) => m.awayId !== null)
      .map((m) => [m.homeId, m.awayId].sort().join("-"))
    expect(pairs).toHaveLength((n * (n - 1)) / 2)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it.each(SIZES)("%i participants: nobody plays twice on one matchday", (n) => {
    const s = roundRobinRounds(ids(n))
    const rounds = [...new Set(s.map((m) => m.roundIndex))].sort((a, b) => a - b)
    const expectedRounds = n % 2 === 0 ? n - 1 : n
    expect(rounds).toEqual(Array.from({ length: expectedRounds }, (_, i) => i + 1))
    for (const r of rounds) {
      const playing = s
        .filter((m) => m.roundIndex === r)
        .flatMap((m) => (m.awayId === null ? [m.homeId] : [m.homeId, m.awayId]))
      expect(new Set(playing).size).toBe(playing.length)
    }
  })

  it.each(SIZES)("%i participants: one bye each for an odd field, none for an even one", (n) => {
    const s = roundRobinRounds(ids(n))
    for (const id of ids(n)) {
      const byes = s.filter((m) => m.awayId === null && m.homeId === id).length
      expect(byes).toBe(n % 2 === 0 ? 0 : 1)
    }
  })

  it.each(SIZES)("%i participants: sides are balanced", (n) => {
    for (const [, diff] of sideBalance(n)) {
      // odd field: every participant has an even number of duels → exactly as often A as B;
      // even field: an odd number of duels → one side once more at most
      if (n % 2 === 1) expect(diff).toBe(0)
      else expect(Math.abs(diff)).toBeLessThanOrEqual(1)
    }
  })

  it("never puts one participant on side A in all duels (the reported 5-player case)", () => {
    const s = roundRobinRounds(ids(5)).filter((m) => m.awayId !== null)
    for (const id of ids(5)) {
      const own = s.filter((m) => m.homeId === id || m.awayId === id)
      expect(own.every((m) => m.homeId === id)).toBe(false)
    }
  })
})
