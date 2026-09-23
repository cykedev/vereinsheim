import { getEventWithSeries, getSeasonWithSeries } from "@/lib/competitions/queries"
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { CompetitionPreview } from "@/lib/competitions/previewModel"
import {
  getBestOfStandingsForCompetition,
  getStandingsForCompetition,
} from "@/lib/standings/queries"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { resolveSeasonSort, sortSeasonStandings } from "@/lib/scoring/sortSeasonStandings"

/**
 * Lädt die Vorschau eines Wettbewerbs für seine Karte — Dashboard und Wettbewerbsliste teilen
 * sich diesen einen Weg, damit beide dieselben Zahlen zeigen.
 */
export async function loadCompetitionPreview(c: CompetitionListItem): Promise<CompetitionPreview> {
  if (c.type === "EVENT") return loadEventPreview(c)
  if (c.type === "SEASON") return loadSeasonPreview(c)
  return loadLeaguePreview(c)
}

async function loadLeaguePreview(c: CompetitionListItem): Promise<CompetitionPreview> {
  const isBestOf = c.leagueFormat === "BEST_OF_SINGLE"
  const [standings, bestOfStandings, bracket] = await Promise.all([
    isBestOf ? Promise.resolve([]) : getStandingsForCompetition(c.id),
    isBestOf ? getBestOfStandingsForCompetition(c.id) : Promise.resolve([]),
    getPlayoffBracket(c.id),
  ])
  const playoffsStarted =
    bracket.eighthFinals.length + bracket.quarterFinals.length + bracket.semiFinals.length > 0 ||
    bracket.final !== null
  return {
    kind: "league",
    competition: c,
    href: `/competitions/${c.id}/${playoffsStarted ? "playoffs" : "schedule"}`,
    isBestOf,
    playoffsStarted,
    standings,
    bestOfStandings,
    bracket,
  }
}

async function loadEventPreview(c: CompetitionListItem): Promise<CompetitionPreview> {
  const isTeamEvent = (c.teamSize ?? 0) >= 2
  const href = `/competitions/${c.id}/ranking`
  const data = await getEventWithSeries(c.id)
  if (!data) return { kind: "event", competition: c, href, isTeamEvent, ranked: [], teamRanked: [] }
  const ranked = rankEventParticipants(data.series, {
    scoringMode: data.competition.scoringMode,
    targetValue: data.competition.targetValue,
    targetValueType: data.competition.targetValueType,
    competitionDisciplineId: data.competition.disciplineId,
    discipline: data.competition.discipline,
  })
  const teamRanked = isTeamEvent
    ? rankEventTeams(ranked, c.teamScoring ?? "SUM", c.scoringMode)
    : []
  return { kind: "event", competition: c, href, isTeamEvent, ranked, teamRanked }
}

async function loadSeasonPreview(c: CompetitionListItem): Promise<CompetitionPreview> {
  const data = await getSeasonWithSeries(c.id)
  const sort = resolveSeasonSort(c.scoringMode, c.seasonSortMode)
  // Erst sortieren, dann in der Karte schneiden — sonst zeigt die Vorschau die falschen Ränge.
  const standings = data
    ? sortSeasonStandings(
        calculateSeasonStandings(
          data.participants.map((p) => ({
            participantId: p.participantId,
            participantName: `${p.lastName}, ${p.firstName}`,
            series: p.series,
          })),
          data.competition.minSeries,
          data.competition.disciplineId
        ),
        sort
      )
    : []
  return {
    kind: "season",
    competition: c,
    href: `/competitions/${c.id}/standings`,
    standings,
    minSeries: data?.competition.minSeries ?? null,
    sort,
  }
}
