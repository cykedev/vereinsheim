"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import {
  SeasonSeriesSchema,
  resolveRingteiler,
  resolveSeasonDiscipline,
  revalidateSeasonPaths,
} from "./_shared"

/**
 * Erfasst eine neue Serie für einen Saison-Teilnehmer.
 * Mehrere Serien pro Teilnehmer erlaubt — immer create, nie upsert.
 */
export async function saveSeasonSeries(
  competitionId: string,
  participantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      type: true,
      status: true,
      shotsPerSeries: true,
      disciplineId: true,
      scoringMode: true,
      targetValueType: true,
    },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.type !== "SEASON") return { error: "Nur für Saison-Wettbewerbe." }
  if (competition.status === "ARCHIVED") return { error: "Archivierte Wettbewerbe sind gesperrt." }

  const cp = await db.competitionParticipant.findFirst({
    where: { competitionId, participantId },
    select: {
      id: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true, teilerFaktor: true } },
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." }

  const parsed = SeasonSeriesSchema.safeParse({
    rings: formData.get("rings"),
    teiler: formData.get("teiler"),
    sessionDate: formData.get("sessionDate"),
    disciplineId: formData.get("disciplineId"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Disziplin: aus formData (gemischt) → Teilnehmer-Disziplin → Competition-Disziplin
  const resolved = await resolveSeasonDiscipline(
    parsed.data.disciplineId,
    cp,
    competition.disciplineId
  )
  if ("error" in resolved) return { error: resolved.error }
  const { resolvedDisciplineId, discipline } = resolved

  const { rings, teiler, sessionDate } = parsed.data

  const scoring = resolveRingteiler(competition, discipline, rings, teiler)
  if ("error" in scoring) return { error: scoring.error }
  const { ringteiler } = scoring

  await db.series.create({
    data: {
      competitionId,
      participantId,
      disciplineId: resolvedDisciplineId,
      rings,
      teiler,
      ringteiler,
      shotCount: competition.shotsPerSeries,
      sessionDate,
      recordedByUserId: session.user.id,
    },
  })

  await db.auditLog.create({
    data: {
      eventType: "SEASON_SERIES_ENTERED",
      entityType: "SERIES",
      entityId: participantId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${cp.participant.firstName} ${cp.participant.lastName}`,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        rings,
        teiler,
        disciplineName: discipline.name,
      },
    },
  })

  await revalidateSeasonPaths(competitionId)
  return { success: true }
}
