"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { CompetitionStatus } from "@/generated/prisma/client"
import type { AuditEventType } from "@/lib/auditLog/types"
import { revalidateCompetitionPaths, revalidatePublicSlug } from "./_shared"
import { findActiveSlugConflict } from "../publicSlugQueries"

/** Erlaubte Statusübergänge */
const ALLOWED_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED", "ACTIVE"],
  ARCHIVED: ["COMPLETED"],
}

export async function setCompetitionStatus(
  id: string,
  status: CompetitionStatus
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, isPublic: true, publicSlug: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  if (!ALLOWED_TRANSITIONS[competition.status].includes(status)) {
    return {
      error: `Statuswechsel von ${competition.status} nach ${status} ist nicht erlaubt.`,
    }
  }

  // Slug conflict check: only one ACTIVE+isPublic competition per slug is allowed
  if (status === "ACTIVE" && competition.isPublic && competition.publicSlug) {
    const conflict = await findActiveSlugConflict(competition.publicSlug, id)
    if (conflict) {
      return {
        error: `Slug '${competition.publicSlug}' ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
      }
    }
  }

  await db.competition.update({ where: { id }, data: { status } })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_STATUS_CHANGED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: id,
      userId: session.user.id,
      competitionId: id,
      details: {
        name: competition.name,
        from: competition.status,
        to: status,
      },
    },
  })

  // Invalidate the public PDF cache when the competition's visibility changes
  if (competition.publicSlug) {
    revalidatePublicSlug(competition.publicSlug)
  }

  revalidateCompetitionPaths()
  return { success: true }
}
