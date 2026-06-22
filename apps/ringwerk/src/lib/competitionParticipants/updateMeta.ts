"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
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

  await revalidateCompetitionParticipantPaths(cp.competitionId)
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

  await revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}
