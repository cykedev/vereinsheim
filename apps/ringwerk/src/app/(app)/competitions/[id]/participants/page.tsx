import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, BarChart2, CalendarDays, ListOrdered, Trophy, UserMinus } from "lucide-react"
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
import { EnrollParticipantForm } from "@/components/app/competitionParticipants/EnrollParticipantForm"
import { CompetitionParticipantActions } from "@/components/app/competitionParticipants/CompetitionParticipantActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
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

  // Für gemischte Wettbewerbe: Disziplinen für Einschreibung bereitstellen
  const enrollDisciplines = isMixed ? allDisciplines : undefined

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
              {competition.discipline?.name ?? "Gemischt"} · Teilnehmerverwaltung
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isEvent ? (
              <>
                <PdfDownloadButton
                  href={`/api/competitions/${id}/starter-list/pdf`}
                  label="Starterliste drucken"
                />
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/series`} title="Serien erfassen">
                    <ListOrdered className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/ranking`} title="Rangliste">
                    <BarChart2 className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : isSeason ? (
              <>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/series`} title="Serien erfassen">
                    <ListOrdered className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/standings`} title="Rangliste">
                    <BarChart2 className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/schedule`} title="Spielplan & Tabelle">
                    <CalendarDays className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                  <Link href={`/competitions/${id}/playoffs`} title="Playoffs">
                    <Trophy className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Einschreiben */}
      {competition.status === "ACTIVE" && (
        <EnrollParticipantForm
          competitionId={id}
          availableParticipants={available}
          disciplines={enrollDisciplines}
          allowGuests={isEvent ? (competition.allowGuests ?? false) : false}
          teamSize={isEvent ? competition.teamSize : null}
          eventTeams={isEvent ? eventTeams : []}
          action={enrollAction}
        />
      )}

      {/* Aktive Teilnehmer */}
      <div>
        <h2 className="mb-2 text-sm font-medium">Eingeschrieben ({activeEntries.length})</h2>
        <div className="rounded-lg border bg-card">
          {activeEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Noch keine Teilnehmer eingeschrieben.
            </p>
          ) : (
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
                    </div>
                    {!cp.isGuest && (
                      <p className="text-xs text-muted-foreground">{cp.participant.contact}</p>
                    )}
                  </div>
                  <CompetitionParticipantActions
                    entry={cp}
                    playoffsStarted={playoffsStarted}
                    disciplines={enrollDisciplines}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zurückgezogene Teilnehmer */}
      {withdrawnEntries.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <UserMinus className="h-4 w-4" />
            Zurückgezogen ({withdrawnEntries.length})
          </div>
          <div className="rounded-lg border bg-card opacity-70">
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
