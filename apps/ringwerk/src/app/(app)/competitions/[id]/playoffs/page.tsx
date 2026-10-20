import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import {
  countOpenGroupMatchups,
  getPlayoffBracket,
  getSeedingStandings,
} from "@/lib/playoffs/queries"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { StartPlayoffsButton } from "@/components/app/playoffs/StartPlayoffsButton"
import { AdvanceRoundButton } from "@/components/app/playoffs/AdvanceRoundButton"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { CompetitionDetailHeader } from "@/components/app/shell/CompetitionDetailHeader"

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Playoffs",
}

export default async function CompetitionPlayoffsPage({ params }: Props) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect("/login")

  const [competition, bracket, standings, pendingCount] = await Promise.all([
    getCompetitionById(id),
    getPlayoffBracket(id),
    // Dieselbe Tabelle, aus der der Start setzt (Best-of: Best-of-Tabelle).
    getSeedingStandings(id),
    countOpenGroupMatchups(id),
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

  let advance: {
    round: "Viertelfinale" | "Halbfinale" | "Finale"
    previous: "Achtelfinale" | "Viertelfinale" | "Halbfinale"
  } | null = null
  if (allAfComplete && bracket.quarterFinals.length === 0) {
    advance = { round: "Viertelfinale", previous: "Achtelfinale" }
  } else if (allQfComplete && bracket.semiFinals.length === 0) {
    advance = { round: "Halbfinale", previous: "Viertelfinale" }
  } else if (allSfComplete && bracket.final === null) {
    advance = { round: "Finale", previous: "Halbfinale" }
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
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Playoffs`}
        id={id}
        current="playoffs"
        links={canManage ? ["participants", "schedule"] : ["schedule"]}
        actions={
          playoffsStarted && <PdfDownloadButton href={`/api/competitions/${id}/pdf/playoffs`} />
        }
      />

      {/* Start-Button (nur Admin, wenn noch nicht gestartet) */}
      {canManage && !playoffsStarted && (
        <div className="rounded-2xl border bg-card p-4">
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
                name={competition.name}
                round={hasAF ? "Achtelfinale" : hasVF ? "Viertelfinale" : "Halbfinale"}
                active={activeCount}
                disabled={!canStart}
                disabledReason={disabledReason}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nächste Runde anlegen (nur Admin, wenn aktuelle Runde abgeschlossen) */}
      {canManage && advance && (
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Alle Matches der aktuellen Runde sind abgeschlossen.
          </p>
          <AdvanceRoundButton
            competitionId={id}
            round={advance.round}
            previous={advance.previous}
          />
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
