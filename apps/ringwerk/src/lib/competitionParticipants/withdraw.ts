"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidateCompetitionParticipantPaths } from "./_shared"

const WithdrawSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})

export async function withdrawParticipant(
  competitionParticipantId: string,
  _prevState: ActionResult | null,
  formData: FormData
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
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status === "WITHDRAWN") return { error: "Teilnehmer ist bereits zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { competitionId: cp.competitionId } })
  if (playoffCount > 0) {
    return { error: "Rückzug nicht möglich — Playoffs haben bereits begonnen." }
  }

  const parsed = WithdrawSchema.safeParse({ reason: formData.get("reason") })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const now = new Date()

  await db.$transaction([
    db.competitionParticipant.update({
      where: { id: competitionParticipantId },
      data: { status: "WITHDRAWN", withdrawnAt: now },
    }),
    db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_WITHDRAWN",
        entityType: "COMPETITION_PARTICIPANT",
        entityId: competitionParticipantId,
        userId: session.user.id,
        competitionId: cp.competitionId,
        details: {
          participantId: cp.participantId,
          name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
          reason: parsed.data.reason ?? null,
          withdrawnAt: now.toISOString(),
        },
      },
    }),
  ])

  await revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

export async function revokeWithdrawal(competitionParticipantId: string): Promise<ActionResult> {
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
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status !== "WITHDRAWN") return { error: "Teilnehmer ist nicht zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { competitionId: cp.competitionId } })
  if (playoffCount > 0) {
    return {
      error: "Rückzug kann nicht rückgängig gemacht werden — Playoffs haben bereits begonnen.",
    }
  }

  await db.$transaction([
    db.competitionParticipant.update({
      where: { id: competitionParticipantId },
      data: { status: "ACTIVE", withdrawnAt: null },
    }),
    db.auditLog.create({
      data: {
        eventType: "WITHDRAWAL_REVOKED",
        entityType: "COMPETITION_PARTICIPANT",
        entityId: competitionParticipantId,
        userId: session.user.id,
        competitionId: cp.competitionId,
        details: {
          participantId: cp.participantId,
          name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
        },
      },
    }),
  ])

  await revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}
