import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import {
  getCompetitionsForManagement,
  getEventWithSeries,
  getSeasonWithSeries,
} from "@/lib/competitions/queries"
import {
  getBestOfStandingsForCompetition,
  getStandingsForCompetition,
} from "@/lib/standings/queries"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { BestOfStandingsTable } from "@/components/app/standings/BestOfStandingsTable"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { EventRankingTable } from "@/components/app/series/EventRankingTable"
import { EventTeamRankingTable } from "@/components/app/series/EventTeamRankingTable"
import { SeasonStandingsTable } from "@/components/app/series/SeasonStandingsTable"
import { Badge } from "@vereinsheim/ui/badge"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"
import { DashboardCompetitionCard } from "@/components/app/dashboard/DashboardCompetitionCard"

// Vorschau-Länge der Tabellen auf dem Dashboard; der Rest steht auf der Detailseite.
const PREVIEW_ROWS = 6

// ─── DashboardPage ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const competitions = await getCompetitionsForManagement()
  const active = competitions.filter((c) => c.status === "ACTIVE")
  const activeLeagues = active.filter((c) => c.type === "LEAGUE")
  const activeEvents = active.filter((c) => c.type === "EVENT")
  const activeSeasons = active.filter((c) => c.type === "SEASON")

  const [leagueData, eventData, seasonData] = await Promise.all([
    Promise.all(
      activeLeagues.map(async (c) => {
        const isBestOf = c.leagueFormat === "BEST_OF_SINGLE"
        const [standings, bestOfStandings, bracket] = await Promise.all([
          isBestOf ? Promise.resolve([]) : getStandingsForCompetition(c.id),
          isBestOf ? getBestOfStandingsForCompetition(c.id) : Promise.resolve([]),
          getPlayoffBracket(c.id),
        ])
        return { competition: c, isBestOf, standings, bestOfStandings, bracket }
      })
    ),
    Promise.all(
      activeEvents.map(async (c) => {
        const data = await getEventWithSeries(c.id)
        if (!data) return { competition: c, ranked: [], teamRanked: [] }
        const ranked = rankEventParticipants(data.series, {
          scoringMode: data.competition.scoringMode,
          targetValue: data.competition.targetValue,
          targetValueType: data.competition.targetValueType,
          competitionDisciplineId: data.competition.disciplineId,
          discipline: data.competition.discipline,
        })
        const isTeamEvent = (c.teamSize ?? 0) >= 2
        const teamRanked = isTeamEvent
          ? rankEventTeams(ranked, c.teamScoring ?? "SUM", c.scoringMode)
          : []
        return { competition: c, ranked, teamRanked }
      })
    ),
    Promise.all(
      activeSeasons.map(async (c) => {
        const data = await getSeasonWithSeries(c.id)
        const standings = data
          ? calculateSeasonStandings(
              data.participants.map((p) => ({
                participantId: p.participantId,
                participantName: `${p.lastName}, ${p.firstName}`,
                series: p.series,
              })),
              data.competition.minSeries,
              data.competition.disciplineId
            )
          : []
        return { competition: c, standings, minSeries: data?.competition.minSeries ?? null }
      })
    ),
  ])

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Aktive Wettbewerbe auf einen Blick" />

      {active.length === 0 ? (
        <EmptyState
          title="Keine aktiven Wettbewerbe"
          description="Aktive Wettbewerbe erscheinen hier mit Tabelle bzw. Rangliste."
          icon={Trophy}
        />
      ) : (
        <div className="space-y-4">
          {/* Liga-Wettbewerbe: Tabelle / Playoffs */}
          {leagueData.map(({ competition, isBestOf, standings, bestOfStandings, bracket }) => {
            const playoffsStarted =
              bracket.eighthFinals.length +
                bracket.quarterFinals.length +
                bracket.semiFinals.length >
                0 || bracket.final !== null
            const rows = isBestOf ? bestOfStandings : standings

            return (
              <DashboardCompetitionCard
                key={competition.id}
                title={competition.name}
                href={`/competitions/${competition.id}/${playoffsStarted ? "playoffs" : "schedule"}`}
                badges={
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {competition.discipline?.name ?? "Gemischt"}
                    </Badge>
                    {playoffsStarted && (
                      <Badge variant="outline" className="text-xs">
                        <Trophy className="mr-1 h-3 w-3" />
                        Playoffs
                      </Badge>
                    )}
                  </>
                }
                moreCount={playoffsStarted ? undefined : Math.max(0, rows.length - PREVIEW_ROWS)}
                isEmpty={!playoffsStarted && rows.length === 0}
                emptyText="Noch keine Ergebnisse erfasst"
              >
                {playoffsStarted ? (
                  <PlayoffBracket
                    bracket={bracket}
                    canManage={false}
                    compact={true}
                    scoringType={getEffectiveScoringType(
                      competition.scoringMode,
                      competition.discipline
                    )}
                    shotsPerSeries={competition.shotsPerSeries}
                  />
                ) : isBestOf ? (
                  <BestOfStandingsTable rows={bestOfStandings.slice(0, PREVIEW_ROWS)} />
                ) : (
                  <StandingsTable rows={standings.slice(0, PREVIEW_ROWS)} />
                )}
              </DashboardCompetitionCard>
            )
          })}

          {/* Events: Rangliste */}
          {eventData.map(({ competition: c, ranked, teamRanked }) => {
            const isTeamEvent = (c.teamSize ?? 0) >= 2
            const rows = isTeamEvent ? teamRanked : ranked

            return (
              <DashboardCompetitionCard
                key={c.id}
                title={c.name}
                href={`/competitions/${c.id}/ranking`}
                badges={
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {c.discipline?.name ?? "Gemischt"}
                    </Badge>
                    {isTeamEvent && (
                      <Badge variant="outline" className="text-xs">
                        Teams
                      </Badge>
                    )}
                  </>
                }
                moreCount={Math.max(0, rows.length - PREVIEW_ROWS)}
                isEmpty={rows.length === 0}
                emptyText="Noch keine Ergebnisse erfasst"
              >
                {isTeamEvent ? (
                  <EventTeamRankingTable
                    entries={teamRanked.slice(0, PREVIEW_ROWS)}
                    scoringMode={c.scoringMode}
                    teamScoring={c.teamScoring ?? "SUM"}
                  />
                ) : (
                  <EventRankingTable
                    entries={ranked.slice(0, PREVIEW_ROWS)}
                    scoringMode={c.scoringMode}
                    targetValueType={c.targetValueType}
                    isMixed={!c.discipline}
                  />
                )}
              </DashboardCompetitionCard>
            )
          })}

          {/* Saisons: Rangliste */}
          {seasonData.map(({ competition: c, standings, minSeries }) => (
            <DashboardCompetitionCard
              key={c.id}
              title={c.name}
              href={`/competitions/${c.id}/standings`}
              badges={
                <Badge variant="secondary" className="text-xs">
                  {c.discipline?.name ?? "Gemischt"}
                </Badge>
              }
              moreCount={Math.max(0, standings.length - PREVIEW_ROWS)}
              isEmpty={standings.length === 0}
              emptyText="Noch keine Serien erfasst"
            >
              <SeasonStandingsTable
                entries={standings.slice(0, PREVIEW_ROWS)}
                minSeries={minSeries}
                scoringMode={c.scoringMode}
                isMixed={!c.discipline}
              />
            </DashboardCompetitionCard>
          ))}
        </div>
      )}
    </div>
  )
}
