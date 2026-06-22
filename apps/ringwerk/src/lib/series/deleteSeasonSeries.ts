"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidateSeasonPaths } from "./_shared"

/** Löscht eine einzelne Saison-Serie. */
export async function deleteSeasonSeries(
  seriesId: string,
  competitionId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const series = await db.series.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      competitionId: true,
      rings: true,
      teiler: true,
      sessionDate: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!series) return { error: "Serie nicht gefunden." }
  if (series.competitionId !== competitionId) return { error: "Ungültige Anfrage." }

  await db.series.delete({ where: { id: seriesId } })

  await db.auditLog.create({
    data: {
      eventType: "SEASON_SERIES_DELETED",
      entityType: "SERIES",
      entityId: seriesId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${series.participant.firstName} ${series.participant.lastName}`,
        sessionDate: series.sessionDate.toISOString().slice(0, 10),
        rings: series.rings,
        teiler: series.teiler,
      },
    },
  })

  await revalidateSeasonPaths(competitionId)
  return { success: true }
}
