import { describe, expect, it } from "vitest"
import type { StandingRow } from "@/lib/standings/calculateStandings"
import {
  createFirstRoundMatchups,
  createNextRoundMatchups,
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  finaleNeedsTeiler,
  isPlayoffMatchComplete,
  requiredWinsFromBestOf,
} from "./calculatePlayoffs"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStandings(ids: string[], withdrawn: string[] = []): StandingRow[] {
  return ids.map((id, i) => ({
    participantId: id,
    firstName: "Name",
    lastName: `${i + 1}`,
    withdrawn: withdrawn.includes(id),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    byes: 0,
    points: ids.length - i, // absteigend, damit Rang stimmt
    bestRingteiler: null,
    bestRings: null,
    rank: i + 1,
  }))
}

// ─── requiredWinsFromBestOf ──────────────────────────────────────────────────

describe("requiredWinsFromBestOf", () => {
  it("null → 3 Siege (Best-of-5 Standard)", () => {
    expect(requiredWinsFromBestOf(null)).toBe(3)
  })

  it("Best-of-5 → 3 Siege", () => {
    expect(requiredWinsFromBestOf(5)).toBe(3)
  })

  it("Best-of-3 → 2 Siege", () => {
    expect(requiredWinsFromBestOf(3)).toBe(2)
  })

  it("Best-of-7 → 4 Siege", () => {
    expect(requiredWinsFromBestOf(7)).toBe(4)
  })

  it("Best-of-1 → 1 Sieg", () => {
    expect(requiredWinsFromBestOf(1)).toBe(1)
  })
})

// ─── determineFinaleRoundWinner ──────────────────────────────────────────────

describe("determineFinaleRoundWinner", () => {
  describe("Primär: RINGS (default)", () => {
    it("höhere Ringzahl gewinnt (A)", () => {
      expect(determineFinaleRoundWinner(97, 95)).toBe("A")
    })

    it("höhere Ringzahl gewinnt (B)", () => {
      expect(determineFinaleRoundWinner(94, 96)).toBe("B")
    })

    it("gleiche Ringzahl → DRAW (Verlängerung nötig)", () => {
      expect(determineFinaleRoundWinner(95, 95)).toBe("DRAW")
    })

    it("explicit RINGS primary: A gewinnt", () => {
      expect(determineFinaleRoundWinner(97, 95, "RINGS")).toBe("A")
    })
  })

  describe("Primär: RINGTEILER", () => {
    it("niedrigerer Ringteiler gewinnt (A)", () => {
      expect(determineFinaleRoundWinner(95, 95, "RINGTEILER", 4.0, 1.0, 5.0, 2.0)).toBe("A")
    })

    it("niedrigerer Ringteiler gewinnt (B)", () => {
      expect(determineFinaleRoundWinner(95, 95, "RINGTEILER", 6.0, 1.0, 5.0, 2.0)).toBe("B")
    })

    it("gleicher Ringteiler → DRAW", () => {
      expect(determineFinaleRoundWinner(95, 95, "RINGTEILER", 5.0, 1.0, 5.0, 2.0)).toBe("DRAW")
    })
  })

  describe("Primär: TEILER", () => {
    it("niedrigerer Teiler gewinnt (A)", () => {
      expect(determineFinaleRoundWinner(95, 95, "TEILER", undefined, 1.0, undefined, 2.0)).toBe("A")
    })

    it("niedrigerer Teiler gewinnt (B)", () => {
      expect(determineFinaleRoundWinner(95, 95, "TEILER", undefined, 3.0, undefined, 2.0)).toBe("B")
    })
  })

  describe("Kette: primary → tb1 → tb2", () => {
    it("primary RINGS entscheidet sofort (kein TB nötig)", () => {
      expect(
        determineFinaleRoundWinner(
          97,
          95,
          "RINGS",
          undefined,
          undefined,
          undefined,
          undefined,
          "TEILER",
          "RINGTEILER"
        )
      ).toBe("A")
    })

    it("primary DRAW → tb1 TEILER entscheidet", () => {
      // Gleiche Ringe, A hat kleineren Teiler
      expect(
        determineFinaleRoundWinner(95, 95, "RINGS", undefined, 1.0, undefined, 2.0, "TEILER", null)
      ).toBe("A")
    })

    it("primary + tb1 DRAW → tb2 TEILER entscheidet", () => {
      // Gleiche Ringe, tb1=RINGS (nochmals gleich) → tb2 TEILER: A kleiner
      expect(
        determineFinaleRoundWinner(
          95,
          95,
          "RINGS",
          undefined,
          1.0,
          undefined,
          2.0,
          "RINGS",
          "TEILER"
        )
      ).toBe("A")
    })

    it("primary + tb1 + tb2 alle DRAW → DRAW (Verlängerung)", () => {
      // Alle Kriterien zeigen Gleichstand
      expect(
        determineFinaleRoundWinner(
          95,
          95,
          "RINGS",
          undefined,
          1.0,
          undefined,
          1.0,
          "TEILER",
          "RINGS"
        )
      ).toBe("DRAW")
    })
  })
})

// ─── finaleNeedsTeiler ──────────────────────────────────────────────────────

describe("finaleNeedsTeiler", () => {
  it("RINGS → false", () => {
    expect(finaleNeedsTeiler("RINGS")).toBe(false)
  })

  it("RINGS_DECIMAL → false", () => {
    expect(finaleNeedsTeiler("RINGS_DECIMAL")).toBe(false)
  })

  it("RINGTEILER primary → true", () => {
    expect(finaleNeedsTeiler("RINGTEILER")).toBe(true)
  })

  it("TEILER primary → true", () => {
    expect(finaleNeedsTeiler("TEILER")).toBe(true)
  })

  it("RINGS primary + TEILER tb1 → true", () => {
    expect(finaleNeedsTeiler("RINGS", "TEILER", null)).toBe(true)
  })

  it("RINGS primary + RINGS tb1 + RINGTEILER tb2 → true", () => {
    expect(finaleNeedsTeiler("RINGS", "RINGS", "RINGTEILER")).toBe(true)
  })

  it("RINGS + null + null → false", () => {
    expect(finaleNeedsTeiler("RINGS", null, null)).toBe(false)
  })
})

// ─── determinePlayoffDuelWinner ──────────────────────────────────────────────

describe("determinePlayoffDuelWinner", () => {
  it("niedrigerer Ringteiler gewinnt (A)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 6.0, 94, 0)).toBe("A")
  })

  it("niedrigerer Ringteiler gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(6.0, 94, 0, 5.0, 95, 0)).toBe("B")
  })

  it("Gleichstand Ringteiler: höhere Seriensumme gewinnt (A)", () => {
    // RT gleich, aber A hat mehr Ringe
    expect(determinePlayoffDuelWinner(5.0, 96, 1, 5.0, 95, 0)).toBe("A")
  })

  it("Gleichstand Ringteiler: höhere Seriensumme gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 96, 1)).toBe("B")
  })

  it("Gleichstand Ringteiler + Seriensumme: kleinerer Teiler gewinnt (A)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 95, 1)).toBe("A")
  })

  it("Gleichstand Ringteiler + Seriensumme: kleinerer Teiler gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 1, 5.0, 95, 0)).toBe("B")
  })

  it("absoluter Gleichstand → DRAW", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 95, 0)).toBe("DRAW")
  })
})

// ─── isPlayoffMatchComplete ──────────────────────────────────────────────────

describe("isPlayoffMatchComplete", () => {
  it("VF: noch nicht abgeschlossen bei 2:2", () => {
    expect(isPlayoffMatchComplete(2, 2, "QUARTER_FINAL")).toBe(false)
  })

  it("VF: abgeschlossen wenn A 3 Siege", () => {
    expect(isPlayoffMatchComplete(3, 2, "QUARTER_FINAL")).toBe(true)
  })

  it("VF: abgeschlossen wenn B 3 Siege", () => {
    expect(isPlayoffMatchComplete(1, 3, "QUARTER_FINAL")).toBe(true)
  })

  it("HF: noch nicht abgeschlossen bei 2:1", () => {
    expect(isPlayoffMatchComplete(2, 1, "SEMI_FINAL")).toBe(false)
  })

  it("HF: abgeschlossen wenn A 3 Siege", () => {
    expect(isPlayoffMatchComplete(3, 0, "SEMI_FINAL")).toBe(true)
  })

  it("Finale: bereits nach 1 Sieg abgeschlossen (A)", () => {
    expect(isPlayoffMatchComplete(1, 0, "FINAL")).toBe(true)
  })

  it("Finale: bereits nach 1 Sieg abgeschlossen (B)", () => {
    expect(isPlayoffMatchComplete(0, 1, "FINAL")).toBe(true)
  })

  it("Finale: noch offen bei 0:0", () => {
    expect(isPlayoffMatchComplete(0, 0, "FINAL")).toBe(false)
  })

  it("Best-of-3 (requiredWins=2): abgeschlossen bei 2:1", () => {
    expect(isPlayoffMatchComplete(2, 1, "QUARTER_FINAL", 2)).toBe(true)
  })

  it("Best-of-3 (requiredWins=2): noch offen bei 1:1", () => {
    expect(isPlayoffMatchComplete(1, 1, "QUARTER_FINAL", 2)).toBe(false)
  })

  it("Best-of-7 (requiredWins=4): noch offen bei 3:3", () => {
    expect(isPlayoffMatchComplete(3, 3, "SEMI_FINAL", 4)).toBe(false)
  })

  it("Best-of-7 (requiredWins=4): abgeschlossen bei 4:2", () => {
    expect(isPlayoffMatchComplete(4, 2, "SEMI_FINAL", 4)).toBe(true)
  })
})

// ─── createFirstRoundMatchups ────────────────────────────────────────────────

describe("createFirstRoundMatchups", () => {
  it("hasVF=false, 4 Teilnehmer → SEMI_FINAL (1v4, 2v3)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4"])
    const result = createFirstRoundMatchups(standings, {
      playoffHasViertelfinale: false,
      playoffHasAchtelfinale: false,
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      participantAId: "p1",
      participantBId: "p4",
      round: "SEMI_FINAL",
    })
    expect(result[1]).toMatchObject({
      participantAId: "p2",
      participantBId: "p3",
      round: "SEMI_FINAL",
    })
  })

  it("hasVF=false, 7 Teilnehmer → SEMI_FINAL (Top4: 1v4, 2v3)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7"])
    const result = createFirstRoundMatchups(standings, {
      playoffHasViertelfinale: false,
      playoffHasAchtelfinale: false,
    })
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.round === "SEMI_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p4" })
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p3" })
  })

  it("hasVF=true (default), 8 Teilnehmer → QUARTER_FINAL (1v8, 2v7, 3v6, 4v5)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(4)
    expect(result.every((m) => m.round === "QUARTER_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p8" })
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p7" })
    expect(result[2]).toMatchObject({ participantAId: "p3", participantBId: "p6" })
    expect(result[3]).toMatchObject({ participantAId: "p4", participantBId: "p5" })
  })

  it("hasVF=true (default), 10 Teilnehmer → QUARTER_FINAL (nur Top8)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(4)
    // p9 und p10 nicht dabei
    const allIds = result.flatMap((m) => [m.participantAId, m.participantBId])
    expect(allIds).not.toContain("p9")
    expect(allIds).not.toContain("p10")
  })

  it("playoffHasAchtelfinale=true: 16 Teilnehmer → EIGHTH_FINAL (1v16, 2v15, …)", () => {
    const standings = makeStandings([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p10",
      "p11",
      "p12",
      "p13",
      "p14",
      "p15",
      "p16",
    ])
    const result = createFirstRoundMatchups(standings, {
      playoffHasViertelfinale: true,
      playoffHasAchtelfinale: true,
    })
    expect(result).toHaveLength(8)
    expect(result.every((m) => m.round === "EIGHTH_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p16" })
    expect(result[7]).toMatchObject({ participantAId: "p8", participantBId: "p9" })
  })

  it("playoffHasViertelfinale=false: 5 Teilnehmer → SEMI_FINAL (Top4: 1v4, 2v3)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5"])
    const result = createFirstRoundMatchups(standings, {
      playoffHasViertelfinale: false,
      playoffHasAchtelfinale: false,
    })
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.round === "SEMI_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p4" })
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p3" })
    const allIds = result.flatMap((m) => [m.participantAId, m.participantBId])
    expect(allIds).not.toContain("p5")
  })

  it("Zurückgezogene Teilnehmer werden ausgeschlossen", () => {
    // p1 ist zurückgezogen → p2, p3, p4, p5 qualifizieren sich für SEMI_FINAL (hasVF=false)
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5"], ["p1"])
    const result = createFirstRoundMatchups(standings, {
      playoffHasViertelfinale: false,
      playoffHasAchtelfinale: false,
    })
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.round === "SEMI_FINAL")).toBe(true)
    const allIds = result.flatMap((m) => [m.participantAId, m.participantBId])
    expect(allIds).not.toContain("p1")
    expect(allIds).toContain("p2")
    expect(allIds).toContain("p5")
  })
})

// ─── createNextRoundMatchups ─────────────────────────────────────────────────

describe("createNextRoundMatchups", () => {
  it("normales Szenario: Re-Seeding nach Original-Rang", () => {
    // VF-Gewinner: p1, p2, p3, p4 (alle nach Gruppenrang)
    const rankMap = new Map([
      ["p1", 1],
      ["p2", 2],
      ["p3", 3],
      ["p4", 4],
    ])
    const result = createNextRoundMatchups(["p1", "p2", "p3", "p4"], rankMap)
    expect(result).toHaveLength(2)
    // Bester (p1) vs. Schlechtester (p4)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p4" })
    // Zweiter (p2) vs. Dritter (p3)
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p3" })
  })

  it("Upset-Szenario: p8 schlägt p1 → p8 bekommt schlechtesten HF-Platz", () => {
    // VF-Gewinner: p8 (upset), p2, p3, p4
    const rankMap = new Map([
      ["p8", 8],
      ["p2", 2],
      ["p3", 3],
      ["p4", 4],
    ])
    const result = createNextRoundMatchups(["p8", "p2", "p3", "p4"], rankMap)
    // Sortiert nach Rang: p2(2), p3(3), p4(4), p8(8)
    expect(result[0]).toMatchObject({ participantAId: "p2", participantBId: "p8" })
    expect(result[1]).toMatchObject({ participantAId: "p3", participantBId: "p4" })
  })
})
