import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { getStandingsForCompetition } from "@/lib/standings/queries"
import { db } from "@/lib/db"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { StartPlayoffsButton } from "@/components/app/playoffs/StartPlayoffsButton"
import { AdvanceRoundButton } from "@/components/app/playoffs/AdvanceRoundButton"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompetitionPlayoffsPage({ params }: Props) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect("/login")

  const [competition, bracket, standings, pendingCount] = await Promise.all([
    getCompetitionById(id),
    getPlayoffBracket(id),
    getStandingsForCompetition(id),
    db.matchup.count({ where: { competitionId: id, status: "PENDING" } }),
  ])

  if (!competition) notFound()

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const playoffsStarted =
    bracket.eighthFinals.length + bracket.quarterFinals.length + bracket.semiFinals.length > 0 ||
    bracket.final !== null

  // Prüfen ob nächste Runde manuell angelegt werden kann
  const allAfComplete =
    bracket.eighthFinals.length > 0 && bracket.eighthFinals.every((m) => m.status === "COMPLETED")
  const allQfComplete =
    bracket.quarterFinals.length > 0 && bracket.quarterFinals.every((m) => m.status === "COMPLETED")
  const allSfComplete =
    bracket.semiFinals.length > 0 && bracket.semiFinals.every((m) => m.status === "COMPLETED")

  let advanceLabel: string | null = null
  if (allAfComplete && bracket.quarterFinals.length === 0) {
    advanceLabel = "Viertelfinale anlegen"
  } else if (allQfComplete && bracket.semiFinals.length === 0) {
    advanceLabel = "Halbfinale anlegen"
  } else if (allSfComplete && bracket.final === null) {
    advanceLabel = "Finale anlegen"
  }

  const hasAF = competition.playoffHasAchtelfinale
  const hasVF = competition.playoffHasViertelfinale
  const minRequired = hasAF ? 16 : hasVF ? 8 : 4
  const activeCount = standings.filter((r) => !r.withdrawn).length
  const canStart = activeCount >= minRequired && pendingCount === 0

  let disabledReason: string | undefined
  if (activeCount < minRequired) {
    disabledReason = `Mindestens ${minRequired} aktive Teilnehmer erforderlich.`
  } else if (pendingCount > 0) {
    disabledReason = `Noch ${pendingCount} ausstehende Paarung${pendingCount !== 1 ? "en" : ""} in der Gruppenphase.`
  }

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
            <p className="mt-1 text-sm text-muted-foreground">
              {competition.discipline?.name} · Playoffs
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <Button asChild variant="outline" size="icon" className="h-9 w-9">
                <Link href={`/competitions/${id}/participants`} title="Teilnehmer">
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/schedule`} title="Spielplan & Tabelle">
                <CalendarDays className="h-4 w-4" />
              </Link>
            </Button>
            {playoffsStarted && <PdfDownloadButton href={`/api/competitions/${id}/pdf/playoffs`} />}
          </div>
        </div>
      </div>

      {/* Start-Button (nur Admin, wenn noch nicht gestartet) */}
      {canManage && !playoffsStarted && (
        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium">Playoffs noch nicht gestartet</p>
                <p className="text-sm text-muted-foreground">
                  {activeCount < minRequired
                    ? `Zu wenige aktive Teilnehmer für Playoffs (mind. ${minRequired} erforderlich).`
                    : hasAF
                      ? `Top 16 von ${activeCount} Teilnehmern qualifizieren sich für das Achtelfinale.`
                      : hasVF
                        ? `Top 8 von ${activeCount} Teilnehmern qualifizieren sich für das Viertelfinale.`
                        : `Top 4 von ${activeCount} Teilnehmern qualifizieren sich für das Halbfinale.`}
                </p>
              </div>
              <StartPlayoffsButton
                competitionId={id}
                disabled={!canStart}
                disabledReason={disabledReason}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nächste Runde anlegen (nur Admin, wenn aktuelle Runde abgeschlossen) */}
      {canManage && advanceLabel && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Alle Matches der aktuellen Runde sind abgeschlossen.
          </p>
          <AdvanceRoundButton competitionId={id} label={advanceLabel} />
        </div>
      )}

      {/* Bracket */}
      {playoffsStarted ? (
        <PlayoffBracket
          bracket={bracket}
          canManage={canManage}
          scoringType={getEffectiveScoringType(competition.scoringMode, competition.discipline)}
          shotsPerSeries={competition.shotsPerSeries}
          playoffBestOf={competition.playoffBestOf}
          finalePrimary={competition.finalePrimary}
          finaleTiebreaker1={competition.finaleTiebreaker1}
          finaleTiebreaker2={competition.finaleTiebreaker2}
        />
      ) : (
        !canManage && (
          <p className="text-sm text-muted-foreground">Die Playoffs wurden noch nicht gestartet.</p>
        )
      )}
    </div>
  )
}
