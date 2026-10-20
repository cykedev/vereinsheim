// Der Turnierbaum markiert den Sieger jedes Duells. Er muss derselbe sein, den Ringwerk beim Zählen der Siege nimmt
// (`storedDuelOutcome`), sonst zeigt die Karte „Unentschieden“ neben einem gezählten Sieg.

import { beforeEach, describe, expect, it, vi } from "vitest"

const { playoffMatchFindMany, competitionFindUnique, participantFindMany } = vi.hoisted(() => ({
  playoffMatchFindMany: vi.fn(),
  competitionFindUnique: vi.fn(),
  participantFindMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    playoffMatch: { findMany: playoffMatchFindMany },
    competition: { findUnique: competitionFindUnique },
    competitionParticipant: { findMany: participantFindMany },
  },
}))

import type { ScoringMode } from "@/generated/prisma/client"
import { storedDuelOutcome } from "./actions/duelOutcome"
import { getPlayoffBracket } from "./queries"

const decimal = (n: number | null) => (n === null ? null : { toNumber: () => n })

interface Side {
  rings: number
  teiler: number | null
  ringteiler: number | null
}

function match(round: "SEMI_FINAL" | "FINAL", duels: [Side, Side][]) {
  return {
    id: `m-${round}`,
    round,
    status: "COMPLETED",
    winsA: 0,
    winsB: 0,
    participantA: { id: "a", firstName: "Anna", lastName: "Ahorn" },
    participantB: { id: "b", firstName: "Ben", lastName: "Birke" },
    duels: duels.map(([a, b], i) => ({
      id: `d${i + 1}`,
      duelNumber: i + 1,
      isSuddenDeath: false,
      isCompleted: true,
      results: [
        {
          participantId: "a",
          totalRings: decimal(a.rings),
          teiler: decimal(a.teiler),
          ringteiler: decimal(a.ringteiler),
        },
        {
          participantId: "b",
          totalRings: decimal(b.rings),
          teiler: decimal(b.teiler),
          ringteiler: decimal(b.ringteiler),
        },
      ],
    })),
  }
}

function rules(
  finalePrimary: ScoringMode,
  finaleTiebreaker1: ScoringMode | null = null,
  finaleTiebreaker2: ScoringMode | null = null
) {
  return { finalePrimary, finaleTiebreaker1, finaleTiebreaker2, disciplineId: "lg" }
}

async function finalDuelWinner(final: [Side, Side]) {
  playoffMatchFindMany.mockResolvedValue([match("FINAL", [final])])
  const bracket = await getPlayoffBracket("c1")
  return bracket.final!.duels[0].winnerId
}

describe("getPlayoffBracket: Sieger eines Duells", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    participantFindMany.mockResolvedValue([])
  })

  it("Finale mit gleichen Ringen und Stichkriterium Ringteiler: der kleinere Ringteiler gewinnt", async () => {
    competitionFindUnique.mockResolvedValue(rules("RINGS", "RINGTEILER"))
    expect(
      await finalDuelWinner([
        { rings: 96, teiler: 12.3, ringteiler: 16.3 },
        { rings: 96, teiler: 45.6, ringteiler: 49.6 },
      ])
    ).toBe("a")
  })

  it("Finale mit Hauptkriterium Ringteiler: der Ringteiler entscheidet, nicht die Ringe", async () => {
    competitionFindUnique.mockResolvedValue(rules("RINGTEILER"))
    expect(
      await finalDuelWinner([
        { rings: 97, teiler: 40, ringteiler: 43 },
        { rings: 95, teiler: 10, ringteiler: 15 },
      ])
    ).toBe("b")
  })

  it("Finale nach Ringen ohne Stichkriterium: gleiche Ringe sind unentschieden", async () => {
    competitionFindUnique.mockResolvedValue(rules("RINGS"))
    expect(
      await finalDuelWinner([
        { rings: 95, teiler: null, ringteiler: null },
        { rings: 95, teiler: null, ringteiler: null },
      ])
    ).toBeNull()
  })

  it("Halbfinale: der kleinere Ringteiler gewinnt", async () => {
    competitionFindUnique.mockResolvedValue(rules("RINGS"))
    playoffMatchFindMany.mockResolvedValue([
      match("SEMI_FINAL", [
        [
          { rings: 97, teiler: 40, ringteiler: 43 },
          { rings: 95, teiler: 10, ringteiler: 15 },
        ],
      ]),
    ])
    const bracket = await getPlayoffBracket("c1")
    expect(bracket.semiFinals[0].duels[0].winnerId).toBe("b")
  })

  it("gemischt, Finale nach Teiler: der korrigierte Teiler entscheidet", async () => {
    competitionFindUnique.mockResolvedValue({ ...rules("TEILER"), disciplineId: null })
    participantFindMany.mockResolvedValue([
      { participantId: "a", discipline: { teilerFaktor: decimal(0.3333333) } },
      { participantId: "b", discipline: { teilerFaktor: decimal(1) } },
    ])
    expect(
      await finalDuelWinner([
        { rings: 95, teiler: 90, ringteiler: 35 },
        { rings: 95, teiler: 35, ringteiler: 40 },
      ])
    ).toBe("a")
  })

  it("feste Disziplin: kein Faktor, auch wenn die Einschreibungen einen hätten", async () => {
    competitionFindUnique.mockResolvedValue(rules("TEILER"))
    participantFindMany.mockResolvedValue([
      { participantId: "a", discipline: { teilerFaktor: decimal(0.3333333) } },
      { participantId: "b", discipline: { teilerFaktor: decimal(1) } },
    ])
    expect(
      await finalDuelWinner([
        { rings: 95, teiler: 90, ringteiler: 95 },
        { rings: 95, teiler: 35, ringteiler: 40 },
      ])
    ).toBe("b")
    expect(participantFindMany).not.toHaveBeenCalled()
  })

  it("markiert in jedem Duell den Sieger, den das Zählen der Siege nimmt", async () => {
    const sides: Side[] = [
      { rings: 96, teiler: 12.3, ringteiler: 16.3 },
      { rings: 96, teiler: 45.6, ringteiler: 49.6 },
      { rings: 97, teiler: 50, ringteiler: 53 },
      { rings: 95, teiler: 5, ringteiler: 10 },
      { rings: 96, teiler: 12.3, ringteiler: 16.3 },
    ]
    const pairs: [Side, Side][] = sides.flatMap((a) => sides.map((b): [Side, Side] => [a, b]))
    const chains: [ScoringMode, ScoringMode | null, ScoringMode | null][] = [
      ["RINGS", null, null],
      ["RINGS", "RINGTEILER", null],
      ["RINGS", "TEILER", "RINGTEILER"],
      ["RINGTEILER", null, null],
      ["TEILER", "RINGS", null],
    ]
    for (const chain of chains) {
      competitionFindUnique.mockResolvedValue(rules(...chain))
      for (const round of ["SEMI_FINAL", "FINAL"] as const) {
        playoffMatchFindMany.mockResolvedValue([match(round, pairs)])
        const bracket = await getPlayoffBracket("c1")
        const item = round === "FINAL" ? bracket.final! : bracket.semiFinals[0]
        item.duels.forEach((duel, i) => {
          const [a, b] = pairs[i].map((s) => ({
            totalRings: decimal(s.rings)!,
            teiler: decimal(s.teiler),
            ringteiler: decimal(s.ringteiler),
          }))
          const counted = storedDuelOutcome(a, b, round === "FINAL", ...chain, { a: 1, b: 1 })
          const expected = counted === "A" ? "a" : counted === "B" ? "b" : null
          expect(duel.winnerId, `${chain.join("/")} ${round} Duell ${i + 1}`).toBe(expected)
        })
      }
    }
  })
})
