import { notFound, redirect } from "next/navigation"
import { Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getMatchupsForCompetition, getScheduleStatus } from "@/lib/matchups/queries"
import { hasPlayoffsStarted } from "@/lib/playoffs/queries"
import {
  getBestOfStandingsForCompetition,
  getStandingsForCompetition,
} from "@/lib/standings/queries"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { GenerateScheduleButton } from "@/components/app/matchups/GenerateScheduleButton"
import { ScheduleView } from "@/components/app/matchups/ScheduleView"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { BestOfStandingsTable } from "@/components/app/standings/BestOfStandingsTable"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import {
  CompetitionDetailHeader,
  DetailNavButton,
} from "@/components/app/shell/CompetitionDetailHeader"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompetitionSchedulePage({ params }: Props) {
  const { id } = await params

  const [session, competition, matchups, scheduleStatus, playoffsStarted] = await Promise.all([
    getAuthSession(),
    getCompetitionById(id),
    getMatchupsForCompetition(id),
    getScheduleStatus(id),
    hasPlayoffsStarted(id),
  ])

  if (!session) redirect("/login")
  if (!competition) notFound()
  if (competition.type !== "LEAGUE") redirect(`/competitions/${id}/ranking`)

  // Load standings after competition type is confirmed — choose query by format
  const isBestOf = competition.leagueFormat === "BEST_OF_SINGLE"
  const [classicStandings, bestOfStandings] = await Promise.all([
    isBestOf ? Promise.resolve([]) : getStandingsForCompetition(id),
    isBestOf ? getBestOfStandingsForCompetition(id) : Promise.resolve([]),
  ])

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const scoringType = getEffectiveScoringType(competition.scoringMode, competition.discipline)

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Spielplan & Tabelle`}
        actions={
          <>
            {canManage && (
              <DetailNavButton
                href={`/competitions/${id}/participants`}
                label="Teilnehmer"
                icon={Users}
              />
            )}
            <DetailNavButton href={`/competitions/${id}/playoffs`} label="Playoffs" icon={Trophy} />
            {scheduleStatus.hasSchedule && (
              <PdfDownloadButton href={`/api/competitions/${id}/pdf/schedule`} />
            )}
            {canManage && competition.status === "ACTIVE" && !scheduleStatus.hasSchedule && (
              <GenerateScheduleButton competitionId={id} hasSchedule={scheduleStatus.hasSchedule} />
            )}
          </>
        }
      />

      {/* Hinweis bei abgeschlossenen Paarungen */}
      {canManage && scheduleStatus.hasCompletedMatchups && competition.status === "ACTIVE" && (
        <p className="text-sm text-muted-foreground">
          Der Spielplan kann nicht mehr neu generiert werden, da bereits{" "}
          {scheduleStatus.totalMatchups} Paarung(en) abgeschlossen sind.
        </p>
      )}

      {/* Spielplan */}
      <ScheduleView
        matchups={matchups}
        hinrundeDeadline={competition.hinrundeDeadline}
        rueckrundeDeadline={competition.rueckrundeDeadline}
        competitionId={id}
        canManage={canManage}
        playoffsStarted={playoffsStarted}
        scoringMode={competition.scoringMode}
        scoringType={scoringType}
        shotsPerSeries={competition.shotsPerSeries}
        competitionTeilerFaktor={effectiveTeilerFaktor(
          competition.disciplineId,
          competition.discipline?.teilerFaktor ?? 1
        )}
        leagueFormat={competition.leagueFormat}
        bestOfConfig={
          competition.leagueFormat === "BEST_OF_SINGLE"
            ? {
                disciplineId: competition.disciplineId,
                groupBestOf: competition.groupBestOf ?? 3,
                groupPlayAllDuels: competition.groupPlayAllDuels,
                groupTiebreaker1: competition.groupTiebreaker1,
                groupTiebreaker2: competition.groupTiebreaker2,
                competitionTeilerFaktor: effectiveTeilerFaktor(
                  competition.disciplineId,
                  competition.discipline?.teilerFaktor ?? 1
                ),
              }
            : undefined
        }
      />

      {/* Tabelle */}
      {isBestOf
        ? bestOfStandings.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-semibold">Tabelle</h2>
              <BestOfStandingsTable rows={bestOfStandings} />
            </div>
          )
        : classicStandings.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-semibold">Tabelle</h2>
              <StandingsTable rows={classicStandings} />
            </div>
          )}
    </div>
  )
}
