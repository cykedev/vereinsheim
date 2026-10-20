"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { offersMinSeriesExemption } from "@/lib/scoring/calculateSeasonStandings"
import { revalidateSeasonPaths } from "@/lib/series/_shared"
import { revalidateCompetitionParticipantPaths } from "./_shared"

export async function updateStartNumber(
  competitionParticipantId: string,
  startNumber: number | null
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: { id: true, competitionId: true },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }

  await db.competitionParticipant.update({
    where: { id: competitionParticipantId },
    data: { startNumber },
  })

  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

export async function updateParticipantDiscipline(
  competitionParticipantId: string,
  disciplineId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      status: true,
      _count: { select: { series: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status !== "ACTIVE") {
    return { error: "Disziplin kann nur bei aktiven Teilnehmern geändert werden." }
  }
  if (cp._count.series > 0) {
    return {
      error: "Disziplin kann nicht mehr geändert werden — es gibt bereits erfasste Serien.",
    }
  }

  const discipline = await db.discipline.findUnique({
    where: { id: disciplineId },
    select: { id: true, isArchived: true },
  })
  if (!discipline || discipline.isArchived) {
    return { error: "Disziplin nicht gefunden oder nicht verfügbar." }
  }

  await db.competitionParticipant.update({
    where: { id: competitionParticipantId },
    data: { disciplineId },
  })

  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

/**
 * Setzt oder nimmt die Ausnahme von der Mindestzahl einer Saison (etwa für die Jugend). Sie ändert
 * die Rangliste, deshalb steht jede Änderung im Protokoll des Wettbewerbs.
 */
export async function updateMinSeriesExemption(
  competitionParticipantId: string,
  exempt: boolean
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      status: true,
      exemptFromMinSeries: true,
      participant: { select: { firstName: true, lastName: true } },
      competition: { select: { type: true, status: true, minSeries: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (!offersMinSeriesExemption(cp.competition)) {
    return {
      error: "Eine Ausnahme von der Mindestzahl gibt es nur in einer Saison mit Mindestzahl.",
    }
  }
  if (cp.competition.status !== "ACTIVE") return { error: "Die Saison ist nicht mehr aktiv." }
  if (cp.status !== "ACTIVE") return { error: "Nur bei aktiven Teilnehmern möglich." }
  if (cp.exemptFromMinSeries === exempt) return { success: true }

  await db.$transaction([
    db.competitionParticipant.update({
      where: { id: competitionParticipantId },
      data: { exemptFromMinSeries: exempt },
    }),
    db.auditLog.create({
      data: {
        eventType: "MIN_SERIES_EXEMPTION_CHANGED",
        entityType: "COMPETITION_PARTICIPANT",
        entityId: competitionParticipantId,
        userId: session.user.id,
        competitionId: cp.competitionId,
        details: {
          participantId: cp.participantId,
          name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
          before: { exemptFromMinSeries: cp.exemptFromMinSeries },
          after: { exemptFromMinSeries: exempt },
        },
      },
    }),
  ])

  revalidateCompetitionParticipantPaths(cp.competitionId)
  revalidateSeasonPaths(cp.competitionId)
  return { success: true }
}
