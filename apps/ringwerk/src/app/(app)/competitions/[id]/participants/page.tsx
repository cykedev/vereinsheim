import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { UserMinus, Users } from "lucide-react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getCompetitionParticipants } from "@/lib/competitionParticipants/queries"
import {
  getParticipantsNotInCompetition,
  getAllActiveParticipants,
} from "@/lib/participants/queries"
import { getDisciplines } from "@/lib/disciplines/queries"
import { getEventTeamsForCompetition } from "@/lib/eventTeams/queries"
import { enrollParticipant } from "@/lib/competitionParticipants/actions"
import { hasPlayoffsStarted } from "@/lib/playoffs/queries"
import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { EnrollParticipantForm } from "@/components/app/competitionParticipants/EnrollParticipantForm"
import { CompetitionParticipantActions } from "@/components/app/competitionParticipants/CompetitionParticipantActions"
import { Badge } from "@vereinsheim/ui/badge"
import { CompetitionDetailHeader } from "@/components/app/shell/CompetitionDetailHeader"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import type { ActionResult } from "@/lib/types"
import { offersMinSeriesExemption } from "@/lib/scoring/calculateSeasonStandings"

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Teilnehmerverwaltung",
}

export default async function CompetitionParticipantsPage({ params }: Props) {
  const { id } = await params

  const [session, competition, competitionParticipants, playoffsStarted, allDisciplines] =
    await Promise.all([
      getAuthSession(),
      getCompetitionById(id),
      getCompetitionParticipants(id),
      hasPlayoffsStarted(id),
      getDisciplines(),
    ])

  if (!session || !canManage(session.user.role)) redirect("/")
  if (!competition) notFound()

  const isTeamEvent = (competition.teamSize ?? 0) >= 2
  const displayTimeZone = getDisplayTimeZone()

  // Im Team-Modus darf jeder Teilnehmer mehrfach eingeschrieben werden → alle aktiven anzeigen
  const [available, eventTeams] = await Promise.all([
    isTeamEvent ? getAllActiveParticipants() : getParticipantsNotInCompetition(id),
    isTeamEvent ? getEventTeamsForCompetition(id) : Promise.resolve([]),
  ])

  const enrollAction = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return enrollParticipant(id, prevState, formData)
  }

  const activeEntries = competitionParticipants.filter((cp) => cp.status === "ACTIVE")
  const withdrawnEntries = competitionParticipants.filter((cp) => cp.status === "WITHDRAWN")

  const isEvent = competition.type === "EVENT"
  const isSeason = competition.type === "SEASON"
  const isMixed = !competition.disciplineId

  // Saison mit Mindestzahl: Ausnahme beim Einschreiben, als Zeichen und als Knopf in der Zeile
  const exemptionMinSeries = offersMinSeriesExemption(competition) ? competition.minSeries : null

  // Für gemischte Wettbewerbe: Disziplinen für Einschreibung bereitstellen
  const enrollDisciplines = isMixed ? allDisciplines : undefined

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Teilnehmerverwaltung`}
        id={id}
        current="participants"
        links={
          isEvent
            ? ["series", "ranking"]
            : isSeason
              ? ["series", "standings"]
              : ["schedule", "playoffs"]
        }
        actions={
          isEvent && (
            <PdfDownloadButton
              href={`/api/competitions/${id}/starter-list/pdf`}
              label="Starterliste drucken"
            />
          )
        }
      />

      {/* Einschreiben */}
      {competition.status === "ACTIVE" && (
        <EnrollParticipantForm
          competitionId={id}
          availableParticipants={available}
          disciplines={enrollDisciplines}
          allowGuests={isEvent ? (competition.allowGuests ?? false) : false}
          teamSize={isEvent ? competition.teamSize : null}
          eventTeams={isEvent ? eventTeams : []}
          offersMinSeriesExemption={exemptionMinSeries !== null}
          action={enrollAction}
        />
      )}

      {/* Aktive Teilnehmer */}
      <div>
        <h2 className="mb-2 text-sm font-medium">Eingeschrieben ({activeEntries.length})</h2>
        {activeEntries.length === 0 ? (
          <EmptyState title="Noch keine Teilnehmer eingeschrieben" icon={Users} />
        ) : (
          <div className="rounded-2xl border bg-card">
            <div className="divide-y">
              {activeEntries.map((cp) => (
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
                      {exemptionMinSeries !== null && cp.exemptFromMinSeries && (
                        <Badge variant="outline" className="text-xs">
                          ohne Mindestzahl
                        </Badge>
                      )}
                    </div>
                    {!cp.isGuest && (
                      <p className="text-xs text-muted-foreground">{cp.participant.contact}</p>
                    )}
                  </div>
                  <CompetitionParticipantActions
                    entry={cp}
                    playoffsStarted={playoffsStarted}
                    disciplines={enrollDisciplines}
                    displayTimeZone={displayTimeZone}
                    exemptionMinSeries={exemptionMinSeries}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zurückgezogene Teilnehmer */}
      {withdrawnEntries.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <UserMinus className="h-4 w-4" />
            Zurückgezogen ({withdrawnEntries.length})
          </div>
          <div className="rounded-2xl border bg-card opacity-70">
            <div className="divide-y">
              {withdrawnEntries.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        {cp.isGuest
                          ? cp.participant.firstName
                          : `${cp.participant.lastName}, ${cp.participant.firstName}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Zurückgezogen
                      </Badge>
                    </div>
                    {!cp.isGuest && (
                      <p className="text-xs text-muted-foreground">{cp.participant.contact}</p>
                    )}
                  </div>
                  <CompetitionParticipantActions
                    entry={cp}
                    playoffsStarted={playoffsStarted}
                    disciplines={enrollDisciplines}
                    displayTimeZone={displayTimeZone}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
