import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ListOrdered, Pencil, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getEventWithSeries } from "@/lib/competitions/queries"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { EventRankingTable } from "@/components/app/series/EventRankingTable"
import { EventTeamRankingTable } from "@/components/app/series/EventTeamRankingTable"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/competitions">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Wettbewerbe
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{competition.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {competition.discipline?.name ?? "Gemischt"} · Rangliste
            </p>
            {competition.eventDate && (
              <p className="text-xs text-muted-foreground">
                {formatDateOnly(competition.eventDate, tz)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/participants`} title="Teilnehmer">
                    <Users className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/series`} title="Serien erfassen">
                    <ListOrdered className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/edit`} title="Wettbewerb bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
            <PdfDownloadButton
              href={`/api/competitions/${id}/pdf/ranking`}
              label="PDF exportieren"
            />
          </div>
        </div>
      </div>

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
