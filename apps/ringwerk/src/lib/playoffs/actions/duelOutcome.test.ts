import { describe, expect, it, vi } from "vitest"

const { participantFindFirst } = vi.hoisted(() => ({ participantFindFirst: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: { competitionParticipant: { findFirst: participantFindFirst } },
}))

import { computeDuelOutcome, storedDuelOutcome } from "./duelOutcome"

/** feste Disziplin: der Teiler vom Ausdruck zählt */
const FIXED = { a: 1, b: 1 }

const result = (rings: number, teiler: number, ringteiler: number) => ({
  totalRings: { toNumber: () => rings },
  teiler: { toNumber: () => teiler },
  ringteiler: { toNumber: () => ringteiler },
})

describe("storedDuelOutcome", () => {
  it("Finale mit Teiler als Stichkriterium: zuerst die Ringe, wie beim Eintragen", () => {
    // A hat mehr Ringe, B den kleineren Ringteiler: im Finale (Ringe, dann Teiler) gewinnt A
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), true, "RINGS", "TEILER", null, FIXED)
    ).toBe("A")
  })

  it("Finale mit Teiler als Stichkriterium: bei gleichen Ringen entscheidet der Teiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(95, 5, 10), true, "RINGS", "TEILER", null, FIXED)
    ).toBe("B")
  })

  it("Viertel- und Halbfinale: der kleinere Ringteiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), false, "RINGS", null, null, FIXED)
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
        null,
        FIXED
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
        null,
        FIXED
      )
    ).toBe(expected)
  })
})

describe("gemischter Wettbewerb: der korrigierte Teiler zählt", () => {
  // A schießt Luftpistole (Faktor 0,333), B Luftgewehr (Faktor 1)
  const factors = { a: 0.3333333, b: 1 }
  const lp = { scoringType: "WHOLE" as const, teilerFaktor: { toNumber: () => 0.3333333 } }
  const lg = { scoringType: "WHOLE" as const, teilerFaktor: { toNumber: () => 1 } }
  const mixed = {
    participantAId: "a",
    participantBId: "b",
    competitionId: "c",
    competition: { disciplineId: null, discipline: null },
  }
  const disciplines = () =>
    participantFindFirst.mockImplementation(async ({ where }) => ({
      discipline: where.participantId === "a" ? lp : lg,
    }))

  it("Viertelfinale: bei gleichem Ringteiler und gleichen Ringen entscheidet der korrigierte Teiler", async () => {
    disciplines()
    // A: 95 Ringe, Teiler 90 → korrigiert 29,999997, Ringteiler 35,0. B: 95 Ringe, Teiler 30 → Ringteiler 35,0.
    // Nach dem Teiler vom Ausdruck gewönne B (30 gegen 90).
    const computed = await computeDuelOutcome(
      mixed,
      { totalRingsA: 95, teilerA: 90, totalRingsB: 95, teilerB: 30 },
      false,
      false,
      "RINGS",
      null,
      null
    )
    if ("error" in computed) throw new Error(computed.error)
    expect(computed.outcome).toBe("A")
    expect(
      storedDuelOutcome(result(95, 90, 35), result(95, 30, 35), false, "RINGS", null, null, factors)
    ).toBe("A")
  })

  it("Finale mit Kriterium Teiler: Teiler 90 der Luftpistole schlägt Teiler 35 des Luftgewehrs", async () => {
    disciplines()
    const computed = await computeDuelOutcome(
      mixed,
      { totalRingsA: 95, teilerA: 90, totalRingsB: 95, teilerB: 35 },
      true,
      true,
      "TEILER",
      null,
      null
    )
    if ("error" in computed) throw new Error(computed.error)
    expect(computed.outcome).toBe("A")
    expect(
      storedDuelOutcome(result(95, 90, 35), result(95, 35, 40), true, "TEILER", null, null, factors)
    ).toBe("A")
  })
})
