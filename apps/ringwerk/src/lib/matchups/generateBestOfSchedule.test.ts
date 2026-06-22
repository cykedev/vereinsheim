import { describe, expect, it } from "vitest"
import { generateBestOfSchedule } from "./generateBestOfSchedule"

describe("generateBestOfSchedule", () => {
  it("4 players: 6 pairings, every pair exactly once, no byes", () => {
    const s = generateBestOfSchedule(["a", "b", "c", "d"])
    const pairs = s
      .filter((m) => m.awayId)
      .map((m) => [m.homeId, m.awayId].sort().join("-"))
      .sort()
    expect(pairs).toEqual(["a-b", "a-c", "a-d", "b-c", "b-d", "c-d"])
    expect(s.some((m) => m.awayId === null)).toBe(false)
  })

  it("5 players: 10 pairings, each player exactly one bye", () => {
    const ids = ["a", "b", "c", "d", "e"]
    const s = generateBestOfSchedule(ids)
    expect(s.filter((m) => m.awayId).length).toBe(10)
    for (const id of ids) {
      const byes = s.filter((m) => m.awayId === null && m.homeId === id).length
      expect(byes).toBe(1)
    }
  })

  it("roundIndex starts at 1 and is contiguous", () => {
    const s = generateBestOfSchedule(["a", "b", "c", "d"])
    const rounds = [...new Set(s.map((m) => m.roundIndex))].sort((x, y) => x - y)
    expect(rounds[0]).toBe(1)
    expect(rounds).toEqual(Array.from({ length: rounds.length }, (_, i) => i + 1))
  })
})
