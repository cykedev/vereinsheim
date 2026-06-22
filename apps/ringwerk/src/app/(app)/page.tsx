import Link from "next/link"
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
import { Button } from "@vereinsheim/ui/button"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

// ─── DashboardPage ───────────────────────────────────────────────────────────

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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader title="Dashboard" description="Aktive Wettbewerbe auf einen Blick" />

      {active.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Keine aktiven Wettbewerbe vorhanden.
        </p>
      ) : (
        <div className="space-y-10">
          {/* Liga-Wettbewerbe: Tabelle / Playoffs */}
          {leagueData.map(({ competition, isBestOf, standings, bestOfStandings, bracket }) => {
            const playoffsStarted =
              bracket.eighthFinals.length +
                bracket.quarterFinals.length +
                bracket.semiFinals.length >
                0 || bracket.final !== null

            return (
              <div key={competition.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{competition.name}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {competition.discipline?.name ?? "Gemischt"}
                  </Badge>
                </div>

                {playoffsStarted ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      Playoffs
                    </div>
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
                    <div className="flex justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/competitions/${competition.id}/playoffs`}>Details →</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isBestOf ? (
                      <BestOfStandingsTable
                        rows={bestOfStandings}
                        scoringMode={competition.scoringMode}
                      />
                    ) : (
                      <StandingsTable rows={standings} />
                    )}
                    <div className="flex justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/competitions/${competition.id}/schedule`}>Details →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Events: Rangliste */}
          {eventData.map(({ competition: c, ranked, teamRanked }) => {
            const isTeamEvent = (c.teamSize ?? 0) >= 2
            return (
              <div key={c.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {c.discipline?.name ?? "Gemischt"}
                  </Badge>
                  {isTeamEvent && (
                    <Badge variant="outline" className="text-xs">
                      Teams
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {isTeamEvent ? (
                    <EventTeamRankingTable
                      entries={teamRanked}
                      scoringMode={c.scoringMode}
                      teamScoring={c.teamScoring ?? "SUM"}
                    />
                  ) : (
                    <EventRankingTable
                      entries={ranked}
                      scoringMode={c.scoringMode}
                      targetValueType={c.targetValueType}
                      isMixed={!c.discipline}
                    />
                  )}
                  <div className="flex justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/competitions/${c.id}/ranking`}>Rangliste →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Saisons: Rangliste */}
          {seasonData.map(({ competition: c, standings, minSeries }) => (
            <div key={c.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <Badge variant="secondary" className="text-xs">
                  {c.discipline?.name ?? "Gemischt"}
                </Badge>
              </div>
              <div className="space-y-2">
                <SeasonStandingsTable
                  entries={standings}
                  minSeries={minSeries}
                  scoringMode={c.scoringMode}
                  isMixed={!c.discipline}
                />
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/competitions/${c.id}/standings`}>Rangliste →</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
