import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
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
import { CompetitionDetailHeader } from "@/components/app/shell/CompetitionDetailHeader"
import { HelpMark } from "@/components/app/help/HelpMark"

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Spielplan & Tabelle",
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
  const hasTable = isBestOf ? bestOfStandings.length > 0 : classicStandings.length > 0
  const scoringType = getEffectiveScoringType(competition.scoringMode, competition.discipline)

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Spielplan & Tabelle`}
        id={id}
        current="schedule"
        links={canManage ? ["participants", "playoffs"] : ["playoffs"]}
        actions={
          <>
            {scheduleStatus.hasSchedule && (
              <PdfDownloadButton href={`/api/competitions/${id}/pdf/schedule`} />
            )}
            {/* (Neu) generieren nur, solange noch kein Ergebnis erfasst ist (lib/matchups/regeneration.ts);
                ohne Paarungen gibt es per Definition keins */}
            {canManage &&
              competition.status === "ACTIVE" &&
              scheduleStatus.regenerationBlocker === null && (
                <GenerateScheduleButton
                  competitionId={id}
                  hasSchedule={scheduleStatus.hasSchedule}
                  leagueFormat={competition.leagueFormat}
                />
              )}
          </>
        }
      />

      {/* Hinweis, warum der Spielplan nicht mehr neu generiert werden kann */}
      {canManage &&
        competition.status === "ACTIVE" &&
        scheduleStatus.hasSchedule &&
        scheduleStatus.regenerationBlocker && (
          <p className="text-sm text-muted-foreground">{scheduleStatus.regenerationBlocker}</p>
        )}

      {/* Tabelle */}
      {isBestOf
        ? bestOfStandings.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Tabelle</h2>
                <HelpMark id="best-of-table" className="ml-auto" />
              </div>
              <BestOfStandingsTable rows={bestOfStandings} />
            </div>
          )
        : classicStandings.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Tabelle</h2>
                <HelpMark id="league-table" className="ml-auto" />
              </div>
              <StandingsTable
                rows={classicStandings}
                scoringMode={competition.scoringMode}
                scoringType={scoringType}
              />
            </div>
          )}
      {/* Spielplan unter der Tabelle: zuerst die Antwort „Wo stehe ich?“, dann die Paarungen */}
      {hasTable && <h2 className="pt-2 text-base font-semibold">Spielplan</h2>}
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
    </div>
  )
}
