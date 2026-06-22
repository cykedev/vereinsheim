import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ListOrdered, Pencil, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getSeasonWithSeries } from "@/lib/competitions/queries"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { SeasonStandingsTable } from "@/components/app/series/SeasonStandingsTable"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

interface Props {
  params: Promise<{ id: string }>
}

export default async function SeasonStandingsPage({ params }: Props) {
  const { id } = await params

  const [session, data] = await Promise.all([getAuthSession(), getSeasonWithSeries(id)])

  if (!session) redirect("/login")
  if (!data) notFound()

  const { competition, participants } = data
  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const tz = getDisplayTimeZone()

  const standings = calculateSeasonStandings(
    participants.map((p) => ({
      participantId: p.participantId,
      participantName: `${p.lastName}, ${p.firstName}`,
      series: p.series,
    })),
    competition.minSeries,
    competition.disciplineId
  )

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
            {competition.seasonStart && (
              <p className="text-xs text-muted-foreground">
                {formatDateOnly(competition.seasonStart, tz)}
                {competition.seasonEnd && <> – {formatDateOnly(competition.seasonEnd, tz)}</>}
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
              href={`/api/competitions/${id}/pdf/standings`}
              label="PDF exportieren"
            />
          </div>
        </div>
      </div>

      {/* Info-Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {SCORING_MODE_LABELS[competition.scoringMode] ?? competition.scoringMode}
        </Badge>
        <Badge variant="secondary">{competition.shotsPerSeries} Schuss</Badge>
        {competition.minSeries !== null && (
          <Badge variant="outline">Mindest: {competition.minSeries} Serien</Badge>
        )}
      </div>

      <SeasonStandingsTable
        entries={standings}
        minSeries={competition.minSeries}
        scoringMode={competition.scoringMode}
        isMixed={!competition.disciplineId}
      />
    </div>
  )
}
