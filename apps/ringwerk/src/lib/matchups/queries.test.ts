import { beforeEach, describe, expect, it, vi } from "vitest"

const { competitionFindUnique, matchupFindMany } = vi.hoisted(() => ({
  competitionFindUnique: vi.fn(),
  matchupFindMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUnique },
    matchup: { findMany: matchupFindMany },
  },
}))

import { getMatchupsForCompetition } from "./queries"

const decimal = (n: number) => ({ toNumber: () => n })
const person = (id: string) => ({ id, firstName: id, lastName: id, competitions: [] })

describe("getMatchupsForCompetition: korrigierter Teiler", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    matchupFindMany.mockResolvedValue([
      {
        id: "m1",
        round: "FIRST_LEG",
        roundIndex: 1,
        status: "COMPLETED",
        dueDate: null,
        homeParticipant: person("h"),
        awayParticipant: person("a"),
        series: [
          {
            participantId: "h",
            rings: decimal(95),
            teiler: decimal(90),
            ringteiler: decimal(35),
            duelNumber: null,
            isTiebreak: false,
            discipline: { teilerFaktor: decimal(0.5) },
          },
        ],
      },
    ])
  })

  it("feste Disziplin: der Teiler vom Ausdruck, auch wenn die Disziplin einen Faktor hat", async () => {
    competitionFindUnique.mockResolvedValue({ disciplineId: "lp" })
    const [m] = await getMatchupsForCompetition("c1")
    expect(m.results[0]).toMatchObject({ teiler: 90, correctedTeiler: 90 })
  })

  it("gemischt: Teiler × Faktor der Disziplin der Serie", async () => {
    competitionFindUnique.mockResolvedValue({ disciplineId: null })
    const [m] = await getMatchupsForCompetition("c1")
    expect(m.results[0]).toMatchObject({ teiler: 90, correctedTeiler: 45 })
  })
})
