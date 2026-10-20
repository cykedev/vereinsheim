import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { computeDuelOutcome, storedDuelOutcome } from "./duelOutcome"

const result = (rings: number, teiler: number, ringteiler: number) => ({
  totalRings: { toNumber: () => rings },
  teiler: { toNumber: () => teiler },
  ringteiler: { toNumber: () => ringteiler },
})

describe("storedDuelOutcome", () => {
  it("Finale mit Teiler als Stichkriterium: zuerst die Ringe, wie beim Eintragen", () => {
    // A hat mehr Ringe, B den kleineren Ringteiler: im Finale (Ringe, dann Teiler) gewinnt A
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), true, "RINGS", "TEILER", null)
    ).toBe("A")
  })

  it("Finale mit Teiler als Stichkriterium: bei gleichen Ringen entscheidet der Teiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(95, 5, 10), true, "RINGS", "TEILER", null)
    ).toBe("B")
  })

  it("Viertel- und Halbfinale: der kleinere Ringteiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), false, "RINGS", null, null)
    ).toBe("B")
  })
})

describe("computeDuelOutcome und storedDuelOutcome mit fester Disziplin", () => {
  const match = {
    participantAId: "a",
    participantBId: "b",
    competitionId: "c",
    competition: {
      disciplineId: "lg",
      discipline: { scoringType: "WHOLE" as const, teilerFaktor: { toNumber: () => 1 } },
    },
  }
  const stored = (rings: number, teiler: number | null, ringteiler: number | null) => ({
    totalRings: { toNumber: () => rings },
    teiler: teiler === null ? null : { toNumber: () => teiler },
    ringteiler: ringteiler === null ? null : { toNumber: () => ringteiler },
  })

  it.each([
    ["kleinerer Ringteiler", 95, 30, 94, 5, "B"],
    ["gleicher Ringteiler, mehr Ringe", 96, 20, 95, 19, "A"],
    ["alles gleich", 95, 20, 95, 20, "DRAW"],
  ] as const)("Viertelfinale: %s", async (_, ringsA, teilerA, ringsB, teilerB, expected) => {
    const computed = await computeDuelOutcome(
      match,
      { totalRingsA: ringsA, teilerA, totalRingsB: ringsB, teilerB },
      false,
      false,
      "RINGS",
      null,
      null
    )
    if ("error" in computed) throw new Error(computed.error)
    expect(computed.outcome).toBe(expected)
    // Ringteiler bei zehn Schuss: 100 − Ringe + Teiler
    expect(computed.ringteilerA).toBe(Math.round((100 - ringsA + teilerA) * 10) / 10)
    expect(
      storedDuelOutcome(
        stored(ringsA, teilerA, computed.ringteilerA),
        stored(ringsB, teilerB, computed.ringteilerB),
        false,
        "RINGS",
        null,
        null
      )
    ).toBe(expected)
  })

  it.each([
    ["mehr Ringe", 97, 94, "A"],
    ["gleiche Ringe ohne Stichkriterium", 95, 95, "DRAW"],
  ] as const)("Finale nach Ringen: %s", async (_, ringsA, ringsB, expected) => {
    const computed = await computeDuelOutcome(
      match,
      { totalRingsA: ringsA, totalRingsB: ringsB },
      true,
      false,
      "RINGS",
      null,
      null
    )
    if ("error" in computed) throw new Error(computed.error)
    expect(computed).toEqual({ ringteilerA: null, ringteilerB: null, outcome: expected })
    expect(
      storedDuelOutcome(
        stored(ringsA, null, null),
        stored(ringsB, null, null),
        true,
        "RINGS",
        null,
        null
      )
    ).toBe(expected)
  })
})
