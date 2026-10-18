// Reihenfolge der Lesestellen bei Gleichstand: Zeilen mit gleichem Sortierschlüssel (gleicher Nachname, dieselbe
// `createdAt` aus einem `createMany`) liefert Postgres sonst in einer Folge, die an den IDs und der physischen
// Zeilenfolge hängt. Jede Stelle endet deshalb auf einem eindeutigen Schlüssel; `createdAt` und dann `id` (cuid:
// Zeitstempel, dann ein fortlaufender Zähler) ist die Reihenfolge der Anlage.

import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, competitionFindUnique, getCompetitionById } = vi.hoisted(() => ({
  findMany: {
    competitionParticipant: vi.fn(),
    matchup: vi.fn(),
    playoffMatch: vi.fn(),
    series: vi.fn(),
  },
  competitionFindUnique: vi.fn(),
  getCompetitionById: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUnique },
    competitionParticipant: { findMany: findMany.competitionParticipant },
    matchup: { findMany: findMany.matchup },
    playoffMatch: { findMany: findMany.playoffMatch },
    series: { findMany: findMany.series },
  },
}))
vi.mock("@/lib/competitions/listQueries", () => ({ getCompetitionById }))

import { getCompetitionParticipants } from "./competitionParticipants/queries"
import { getEventWithSeries, getSeasonWithSeries } from "./competitions/seriesQueries"
import { getMatchupsForCompetition } from "./matchups/queries"
import { getPlayoffBracket } from "./playoffs/queries"
import { getBestOfStandingsForCompetition, getStandingsForCompetition } from "./standings/queries"

const orderOf = (mock: ReturnType<typeof vi.fn>) =>
  (mock.mock.calls[0]?.[0] as { orderBy?: unknown } | undefined)?.orderBy

const CREATION = [{ createdAt: "asc" }, { id: "asc" }]

beforeEach(() => {
  vi.resetAllMocks()
  for (const mock of Object.values(findMany)) mock.mockResolvedValue([])
  competitionFindUnique.mockResolvedValue({
    scoringMode: "RINGTEILER",
    disciplineId: null,
    groupBestOf: 3,
    groupPlayAllDuels: true,
    groupTiebreaker1: null,
    groupTiebreaker2: null,
  })
  getCompetitionById.mockResolvedValue({ id: "c1", type: "EVENT" })
})

describe("Reihenfolge bei Gleichstand", () => {
  it("Teilnehmer eines Wettbewerbs: gleicher Nachname nach Vorname, dann eindeutig", async () => {
    await getCompetitionParticipants("c1")
    expect(orderOf(findMany.competitionParticipant)).toEqual([
      { status: "asc" },
      { eventTeam: { teamNumber: "asc" } },
      { participant: { lastName: "asc" } },
      { participant: { firstName: "asc" } },
      { id: "asc" },
    ])
  })

  it("Spielplan: gleicher Nachname des Heimschützen nach Vorname, dann eindeutig", async () => {
    await getMatchupsForCompetition("c1")
    expect(orderOf(findMany.matchup)).toEqual([
      { round: "asc" },
      { roundIndex: "asc" },
      { homeParticipant: { lastName: "asc" } },
      { homeParticipant: { firstName: "asc" } },
      { id: "asc" },
    ])
  })

  it("Bracket: Paarungen einer Runde in der Reihenfolge, in der Ringwerk sie gesetzt hat", async () => {
    await getPlayoffBracket("c1")
    expect(orderOf(findMany.playoffMatch)).toEqual(CREATION)
  })

  it("Tabellen und Serien: Einschreibungen und Serien in der Reihenfolge der Anlage", async () => {
    await getStandingsForCompetition("c1")
    expect(orderOf(findMany.competitionParticipant)).toEqual(CREATION)
    vi.clearAllMocks()
    await getBestOfStandingsForCompetition("c1")
    expect(orderOf(findMany.competitionParticipant)).toEqual(CREATION)
    await getEventWithSeries("c1")
    expect(orderOf(findMany.series)).toEqual(CREATION)
  })

  it("Saison: gleicher Name eindeutig, Serien am selben Tag in der Reihenfolge der Erfassung", async () => {
    getCompetitionById.mockResolvedValue({ id: "c1", type: "SEASON" })
    await getSeasonWithSeries("c1")
    expect(orderOf(findMany.competitionParticipant)).toEqual([
      { participant: { lastName: "asc" } },
      { participant: { firstName: "asc" } },
      { id: "asc" },
    ])
    expect(orderOf(findMany.series)).toEqual([
      { sessionDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ])
  })
})
