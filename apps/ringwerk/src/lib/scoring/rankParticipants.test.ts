import { describe, it, expect } from "vitest"
import { rankByScore } from "./rankParticipants"
import type { RankableEntry } from "./types"

function entry(participantId: string, score: number): RankableEntry {
  return { participantId, score }
}

describe("rankByScore – RINGTEILER (aufsteigend)", () => {
  it("niedrigster Score auf Rang 1", () => {
    const ranked = rankByScore([entry("B", 10.0), entry("A", 7.7), entry("C", 15.0)], "RINGTEILER")
    expect(ranked[0].participantId).toBe("A")
    expect(ranked[0].rank).toBe(1)
    expect(ranked[2].participantId).toBe("C")
    expect(ranked[2].rank).toBe(3)
  })
  it("verändert die Originalliste nicht", () => {
    const entries = [entry("B", 10), entry("A", 5)]
    rankByScore(entries, "RINGTEILER")
    expect(entries[0].participantId).toBe("B")
  })
})

describe("rankByScore – RINGS (absteigend)", () => {
  it("höchster Score auf Rang 1", () => {
    const ranked = rankByScore([entry("A", 90), entry("B", 95), entry("C", 85)], "RINGS")
    expect(ranked[0].participantId).toBe("B")
    expect(ranked[0].rank).toBe(1)
  })
})

describe("rankByScore – RINGS_DECIMAL (absteigend)", () => {
  it("höchste Zehntelringe auf Rang 1", () => {
    const ranked = rankByScore(
      [entry("A", 104.5), entry("B", 106.2), entry("C", 103.8)],
      "RINGS_DECIMAL"
    )
    expect(ranked[0].participantId).toBe("B")
  })
})

describe("rankByScore – TEILER (aufsteigend)", () => {
  it("niedrigster Teiler auf Rang 1", () => {
    const ranked = rankByScore([entry("A", 19.98), entry("B", 5.0), entry("C", 30.0)], "TEILER")
    expect(ranked[0].participantId).toBe("B")
  })
})

describe("rankByScore – DECIMAL_REST (absteigend)", () => {
  it("höchste Nachkommasumme auf Rang 1", () => {
    const ranked = rankByScore([entry("A", 1.4), entry("B", 2.1), entry("C", 0.5)], "DECIMAL_REST")
    expect(ranked[0].participantId).toBe("B")
  })
})

describe("rankByScore – TARGET_ABSOLUTE (aufsteigend)", () => {
  it("kleinste Abweichung auf Rang 1", () => {
    const ranked = rankByScore([entry("A", 10), entry("B", 2), entry("C", 5)], "TARGET_ABSOLUTE")
    expect(ranked[0].participantId).toBe("B")
  })
})

describe("rankByScore – TARGET_UNDER (zweistufig)", () => {
  it("Unter-Zielwert immer vor Über-Zielwert", () => {
    // A: unter Ziel, Score = 5; B: über Ziel, Score = 1e9 + 5
    const ranked = rankByScore([entry("B", 1e9 + 5), entry("A", 5)], "TARGET_UNDER")
    expect(ranked[0].participantId).toBe("A")
    expect(ranked[0].rank).toBe(1)
  })
  it("engste Annäherung unter Zielwert gewinnt", () => {
    const ranked = rankByScore([entry("A", 10), entry("B", 3), entry("C", 7)], "TARGET_UNDER")
    expect(ranked[0].participantId).toBe("B")
  })
  it("engste Annäherung über Zielwert wird korrekt gereiht", () => {
    const ranked = rankByScore(
      [entry("A", 1e9 + 10), entry("B", 1e9 + 2), entry("C", 1e9 + 5)],
      "TARGET_UNDER"
    )
    expect(ranked[0].participantId).toBe("B")
  })
})

describe("rankByScore – Randzustände", () => {
  it("leere Liste gibt leere Liste zurück", () => {
    expect(rankByScore([], "RINGTEILER")).toHaveLength(0)
  })
  it("einzelner Eintrag hat Rang 1", () => {
    const ranked = rankByScore([entry("A", 5)], "RINGTEILER")
    expect(ranked[0].rank).toBe(1)
  })
})
