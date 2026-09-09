import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { ListOrdered, Pencil, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getSeasonWithSeries } from "@/lib/competitions/queries"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import {
  isAlternatingSort,
  resolveSeasonSort,
  SEASON_SORT_LABELS,
  sortSeasonStandings,
} from "@/lib/scoring/sortSeasonStandings"
import { SeasonStandingsTable } from "@/components/app/series/SeasonStandingsTable"
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

export const metadata: Metadata = {
  title: "Rangliste",
}

export default async function SeasonStandingsPage({ params }: Props) {
  const { id } = await params

  const [session, data] = await Promise.all([getAuthSession(), getSeasonWithSeries(id)])

  if (!session) redirect("/login")
  if (!data) notFound()

  const { competition, participants } = data
  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const tz = getDisplayTimeZone()

  // Eine Sortierquelle für Tabelle und PDF (sortSeasonStandings), damit sie nicht auseinanderlaufen.
  const sort = resolveSeasonSort(competition.scoringMode, competition.seasonSortMode)
  const standings = sortSeasonStandings(
    calculateSeasonStandings(
      participants.map((p) => ({
        participantId: p.participantId,
        participantName: `${p.lastName}, ${p.firstName}`,
        series: p.series,
      })),
      competition.minSeries,
      competition.disciplineId
    ),
    sort
  )

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Rangliste`}
        meta={
          competition.seasonStart ? (
            <p className="text-xs text-muted-foreground">
              {formatDateOnly(competition.seasonStart, tz)}
              {competition.seasonEnd && <> – {formatDateOnly(competition.seasonEnd, tz)}</>}
            </p>
          ) : undefined
        }
        actions={
          <>
            {canManage && (
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
                <DetailNavButton
                  href={`/competitions/${id}/edit`}
                  label="Bearbeiten"
                  icon={Pencil}
                />
              </>
            )}
            <PdfDownloadButton href={`/api/competitions/${id}/pdf/standings`} />
          </>
        }
      />

      {/* Info-Badges */}
      <div className="flex flex-wrap gap-2">
        {/* Bei alternierender Sortierung definiert die Reihenfolge die Wertung — der
            scoringMode trägt dann nur noch das Eingabeformat und wäre hier irreführend. */}
        <Badge variant="secondary">
          {isAlternatingSort(sort)
            ? SEASON_SORT_LABELS[sort]
            : (SCORING_MODE_LABELS[competition.scoringMode] ?? competition.scoringMode)}
        </Badge>
        <Badge variant="secondary">{competition.shotsPerSeries} Schuss</Badge>
        {competition.minSeries !== null && (
          <Badge variant="outline">Mindest: {competition.minSeries} Serien</Badge>
        )}
      </div>

      <SeasonStandingsTable
        entries={standings}
        minSeries={competition.minSeries}
        sort={sort}
        isMixed={!competition.disciplineId}
      />
    </div>
  )
}
