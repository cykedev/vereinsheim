import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, BarChart2, Users } from "lucide-react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getCompetitionById, getSeasonWithSeries } from "@/lib/competitions/queries"
import { getCompetitionParticipants } from "@/lib/competitionParticipants/queries"
import { getDisciplines } from "@/lib/disciplines/queries"
import { db } from "@/lib/db"
import { getEffectiveScoringType, formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { EventSeriesDialog } from "@/components/app/series/EventSeriesDialog"
import { DeleteEventSeriesButton } from "@/components/app/series/DeleteEventSeriesButton"
import { SeasonParticipantItem } from "@/components/app/series/SeasonParticipantItem"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { formatDateOnly, getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

interface Props {
  params: Promise<{ id: string }>
}

export default async function SeriesPage({ params }: Props) {
  const { id } = await params

  const [session, competition] = await Promise.all([getAuthSession(), getCompetitionById(id)])

  if (!session || !canManage(session.user.role)) redirect("/")
  if (!competition) notFound()

  if (competition.type === "SEASON") {
    return <SeasonSeriesPageContent id={id} />
  }

  if (competition.type !== "EVENT") redirect(`/competitions/${id}/schedule`)

  // ── EVENT ──────────────────────────────────────────────────────
  const participants = await getCompetitionParticipants(id)

  const existingSeries = await db.series.findMany({
    where: { competitionId: id },
    select: {
      id: true,
      participantId: true,
      competitionParticipantId: true,
      rings: true,
      teiler: true,
    },
  })

  // Key by competitionParticipantId (new data) with fallback to participantId (legacy data)
  const seriesMap = new Map(
    existingSeries.map((s) => [
      s.competitionParticipantId ?? s.participantId,
      { id: s.id, rings: s.rings.toNumber(), teiler: s.teiler.toNumber() },
    ])
  )

  const activeParticipants = participants.filter((p) => p.status === "ACTIVE")
  const isMixed = !competition.disciplineId

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
              {competition.discipline?.name ?? "Gemischt"} · Serien erfassen
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/participants`} title="Teilnehmer">
                <Users className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/ranking`} title="Rangliste">
                <BarChart2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {activeParticipants.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Noch keine Teilnehmer eingeschrieben.{" "}
          <Link href={`/competitions/${id}/participants`} className="underline">
            Teilnehmer einschreiben
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {activeParticipants.map((cp) => {
              const series = seriesMap.get(cp.id) ?? seriesMap.get(cp.participant.id)

              return (
                <div key={cp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {cp.isGuest
                          ? cp.participant.firstName
                          : `${cp.participant.lastName}, ${cp.participant.firstName}`}
                      </span>
                      {cp.isGuest && (
                        <Badge variant="outline" className="text-xs">
                          Gast
                        </Badge>
                      )}
                      {cp.teamNumber != null && (
                        <Badge variant="secondary" className="text-xs">
                          Team {cp.teamNumber}
                        </Badge>
                      )}
                      {isMixed && cp.discipline && (
                        <Badge variant="secondary" className="text-xs">
                          {cp.discipline.name}
                        </Badge>
                      )}
                    </div>
                    {series ? (
                      <p className="text-xs text-muted-foreground">
                        {formatRings(
                          series.rings,
                          getEffectiveScoringType(
                            competition.scoringMode,
                            cp.discipline ?? competition.discipline,
                            competition.targetValueType
                          )
                        )}{" "}
                        Ringe · Teiler {formatDecimal1(series.teiler)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Noch kein Ergebnis</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <EventSeriesDialog
                      competitionId={id}
                      competitionParticipantId={cp.id}
                      participantName={
                        cp.isGuest
                          ? cp.participant.firstName
                          : `${cp.participant.firstName} ${cp.participant.lastName}`
                      }
                      scoringType={getEffectiveScoringType(
                        competition.scoringMode,
                        // For mixed competitions, use the participant's own discipline
                        cp.discipline ?? competition.discipline,
                        competition.targetValueType
                      )}
                      shotsPerSeries={competition.shotsPerSeries}
                      teilerFaktor={effectiveTeilerFaktor(
                        competition.disciplineId,
                        (cp.discipline ?? competition.discipline)?.teilerFaktor ?? 1
                      )}
                      existingSeries={series}
                    />
                    {series && <DeleteEventSeriesButton seriesId={series.id} competitionId={id} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {existingSeries.length} von {activeParticipants.length} Ergebnissen erfasst
      </p>
    </div>
  )
}

// ── SEASON ─────────────────────────────────────────────────────

async function SeasonSeriesPageContent({ id }: { id: string }) {
  const tz = getDisplayTimeZone()

  const [data, allDisciplines] = await Promise.all([getSeasonWithSeries(id), getDisciplines()])

  if (!data) notFound()
  const { competition, participants } = data

  const isMixed = !competition.disciplineId
  const activeParticipants = participants.filter((p) => p.status === "ACTIVE")
  const totalSeries = participants.reduce((sum, p) => sum + p.series.length, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
              {competition.discipline?.name ?? "Gemischt"} · Serien erfassen
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/participants`} title="Teilnehmer">
                <Users className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/standings`} title="Rangliste">
                <BarChart2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {activeParticipants.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Noch keine Teilnehmer eingeschrieben.{" "}
          <Link href={`/competitions/${id}/participants`} className="underline">
            Teilnehmer einschreiben
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {activeParticipants.map((cp) => (
              <SeasonParticipantItem
                key={cp.participantId}
                competitionId={id}
                participantId={cp.participantId}
                firstName={cp.firstName}
                lastName={cp.lastName}
                disciplineName={cp.discipline?.name}
                series={cp.series.map((s) => ({
                  id: s.id,
                  rings: s.rings,
                  teiler: s.teiler,
                  ringteiler: s.ringteiler,
                  sessionDate: formatDateOnly(s.sessionDate, tz),
                  sessionDateIso: s.sessionDate.toISOString().slice(0, 10),
                  disciplineName: isMixed ? s.discipline.name : undefined,
                  disciplineId: s.disciplineId,
                }))}
                minSeries={competition.minSeries}
                isMixed={isMixed}
                scoringMode={competition.scoringMode}
                shotsPerSeries={competition.shotsPerSeries}
                disciplines={
                  isMixed
                    ? allDisciplines.map((d) => ({
                        id: d.id,
                        name: d.name,
                        scoringType: d.scoringType,
                        teilerFaktor: d.teilerFaktor,
                      }))
                    : undefined
                }
                defaultDisciplineId={cp.discipline?.id ?? competition.disciplineId}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {totalSeries} Serie{totalSeries !== 1 ? "n" : ""} erfasst
      </p>
    </div>
  )
}
