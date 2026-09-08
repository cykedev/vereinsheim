import { notFound, redirect } from "next/navigation"
import { ListOrdered, Pencil, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getEventWithSeries } from "@/lib/competitions/queries"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { EventRankingTable } from "@/components/app/series/EventRankingTable"
import { EventTeamRankingTable } from "@/components/app/series/EventTeamRankingTable"
import {
  CompetitionDetailHeader,
  DetailNavButton,
} from "@/components/app/shell/CompetitionDetailHeader"
import { Badge } from "@vereinsheim/ui/badge"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { formatDateOnly, getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventRankingPage({ params }: Props) {
  const { id } = await params

  const [session, data] = await Promise.all([getAuthSession(), getEventWithSeries(id)])

  if (!session) redirect("/login")
  if (!data) notFound()

  const { competition, series } = data
  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const tz = getDisplayTimeZone()

  const eventConfig = {
    scoringMode: competition.scoringMode,
    targetValue: competition.targetValue,
    targetValueType: competition.targetValueType,
    competitionDisciplineId: competition.disciplineId,
    discipline: competition.discipline,
  }

  const ranked = rankEventParticipants(series, eventConfig)

  const isTeamEvent = (competition.teamSize ?? 0) >= 2
  const teamScoring = competition.teamScoring ?? "SUM"
  const teamRanked = isTeamEvent ? rankEventTeams(ranked, teamScoring, competition.scoringMode) : []

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Rangliste`}
        meta={
          competition.eventDate ? (
            <p className="text-xs text-muted-foreground">
              {formatDateOnly(competition.eventDate, tz)}
            </p>
          ) : undefined
        }
        actions={
          canManage ? (
            <>
              <DetailNavButton
                href={`/competitions/${id}/participants`}
                label="Teilnehmer"
                icon={Users}
              />
              <DetailNavButton
                href={`/competitions/${id}/series`}
                label="Serien erfassen"
                icon={ListOrdered}
              />
              <DetailNavButton href={`/competitions/${id}/edit`} label="Bearbeiten" icon={Pencil} />
              <PdfDownloadButton href={`/api/competitions/${id}/pdf/ranking`} />
            </>
          ) : (
            <PdfDownloadButton href={`/api/competitions/${id}/pdf/ranking`} />
          )
        }
      />

      {/* Wertungsmodus-Info */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {SCORING_MODE_LABELS[competition.scoringMode] ?? competition.scoringMode}
        </Badge>
        <Badge variant="secondary">{competition.shotsPerSeries} Schuss</Badge>
        {competition.targetValue != null && (
          <Badge variant="outline">Zielwert: {competition.targetValue}</Badge>
        )}
      </div>

      {isTeamEvent && (
        <EventTeamRankingTable
          entries={teamRanked}
          scoringMode={competition.scoringMode}
          teamScoring={teamScoring}
        />
      )}

      <EventRankingTable
        entries={ranked}
        scoringMode={competition.scoringMode}
        targetValueType={competition.targetValueType}
        isMixed={!competition.disciplineId}
        showTeam={isTeamEvent}
      />
    </div>
  )
}
