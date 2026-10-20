// Der korrigierte Teiler entsteht beim Laden: Faktor der Disziplin der Serie, nur im gemischten Wettbewerb.

import { beforeEach, describe, expect, it, vi } from "vitest"

const { competitionFindUnique, participantFindMany, matchupFindMany } = vi.hoisted(() => ({
  competitionFindUnique: vi.fn(),
  participantFindMany: vi.fn(),
  matchupFindMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUnique },
    competitionParticipant: { findMany: participantFindMany },
    matchup: { findMany: matchupFindMany },
  },
}))

import { getStandingsForCompetition } from "./queries"

const decimal = (n: number) => ({ toNumber: () => n })
const enrolled = (id: string) => ({
  status: "ACTIVE",
  participant: { id, firstName: id, lastName: id },
})
// Heim: Luftpistole, Teiler 90 (× 0,333 = 30,0). Gast: Teiler 35 mit Faktor 1.
const series = (participantId: string, teiler: number, factor: number) => ({
  participantId,
  rings: decimal(95),
  teiler: decimal(teiler),
  ringteiler: decimal(5 + teiler * factor),
  discipline: { teilerFaktor: decimal(factor) },
})

describe("getStandingsForCompetition: Faktor nur im gemischten Wettbewerb", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    participantFindMany.mockResolvedValue([enrolled("h"), enrolled("a")])
    matchupFindMany.mockResolvedValue([
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "h",
        awayParticipantId: "a",
        series: [series("h", 90, 0.3333333), series("a", 35, 1)],
      },
    ])
  })

  it("feste Disziplin Luftpistole: der Teiler vom Ausdruck zählt, der Gast gewinnt", async () => {
    competitionFindUnique.mockResolvedValue({ scoringMode: "TEILER", disciplineId: "lp" })
    const rows = await getStandingsForCompetition("c1")
    expect(rows.map((r) => [r.participantId, r.points])).toEqual([
      ["a", 2],
      ["h", 0],
    ])
  })

  it("gemischt: der korrigierte Teiler zählt, Heim gewinnt", async () => {
    competitionFindUnique.mockResolvedValue({ scoringMode: "TEILER", disciplineId: null })
    const rows = await getStandingsForCompetition("c1")
    expect(rows.map((r) => [r.participantId, r.points])).toEqual([
      ["h", 2],
      ["a", 0],
    ])
  })
})
