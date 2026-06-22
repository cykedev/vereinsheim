"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidateCompetitionParticipantPaths } from "./_shared"

const EnrollSchema = z
  .object({
    participantId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    guestName: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v?.trim() || null),
    startNumber: z
      .string()
      .nullable()
      .optional()
      .transform((v) => {
        if (!v || v.trim() === "") return null
        const n = parseInt(v, 10)
        return isNaN(n) ? null : n
      }),
    isGuest: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    disciplineId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    // Team-Felder (nur bei type=EVENT mit teamSize >= 2)
    teamId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    newTeam: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
  })
  .superRefine((data, ctx) => {
    if (data.isGuest) {
      if (!data.guestName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gastname ist erforderlich",
          path: ["guestName"],
        })
      }
    } else {
      if (!data.participantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Teilnehmer ist erforderlich",
          path: ["participantId"],
        })
      }
    }
  })

export async function enrollParticipant(
  competitionId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, status: true, disciplineId: true, teamSize: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.status !== "ACTIVE") {
    return { error: "Teilnehmer können nur in aktive Wettbewerbe eingeschrieben werden." }
  }

  const parsed = EnrollSchema.safeParse({
    participantId: formData.get("participantId"),
    guestName: formData.get("guestName"),
    startNumber: formData.get("startNumber"),
    isGuest: formData.get("isGuest"),
    disciplineId: formData.get("disciplineId"),
    teamId: formData.get("teamId"),
    newTeam: formData.get("newTeam"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Bei gemischtem Wettbewerb (disciplineId = null) muss Disziplin gewählt werden
  if (!competition.disciplineId && !parsed.data.disciplineId) {
    return { error: "Bei gemischten Wettbewerben muss eine Disziplin gewählt werden." }
  }

  const isTeamEvent = (competition.teamSize ?? 0) >= 2

  // Team-ID auflösen: bestehendes Team oder neues Team anlegen
  let resolvedTeamId: string | null = null
  if (isTeamEvent) {
    if (parsed.data.newTeam) {
      // Nächste Teamnummer berechnen (höchste bestehende + 1)
      const lastTeam = await db.eventTeam.findFirst({
        where: { competitionId },
        orderBy: { teamNumber: "desc" },
        select: { teamNumber: true },
      })
      const nextNumber = (lastTeam?.teamNumber ?? 0) + 1
      const team = await db.eventTeam.create({
        data: { competitionId, teamNumber: nextNumber },
        select: { id: true },
      })
      resolvedTeamId = team.id
    } else if (parsed.data.teamId) {
      // Bestehendes Team prüfen: existiert es, und hat es noch Platz?
      const team = await db.eventTeam.findUnique({
        where: { id: parsed.data.teamId },
        select: {
          id: true,
          competitionId: true,
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
        },
      })
      if (!team || team.competitionId !== competitionId) {
        return { error: "Team nicht gefunden." }
      }
      if (team._count.members >= competition.teamSize!) {
        return { error: "Team ist bereits voll." }
      }
      resolvedTeamId = team.id
    } else {
      return { error: "Bei Team-Events muss ein Team gewählt oder ein neues Team erstellt werden." }
    }
  }

  if (parsed.data.isGuest) {
    // Gast-Pfad: stiller Participant-Record + Einschreibung in einer Transaktion
    await db.$transaction(async (tx) => {
      const guestParticipant = await tx.participant.create({
        data: {
          firstName: parsed.data.guestName!,
          lastName: "",
          contact: null,
          isActive: true,
          isGuestRecord: true,
          createdByUserId: session.user.id,
        },
      })
      await tx.competitionParticipant.create({
        data: {
          competitionId,
          participantId: guestParticipant.id,
          startNumber: parsed.data.startNumber,
          isGuest: true,
          disciplineId: parsed.data.disciplineId,
          eventTeamId: resolvedTeamId,
        },
      })
    })
  } else {
    // Duplikat-Prüfung: abhängig von Team-Modus
    if (isTeamEvent) {
      // Im Team-Modus: gleicher Teilnehmer darf nicht in dasselbe Team zweimal
      const existing = await db.competitionParticipant.findFirst({
        where: {
          competitionId,
          participantId: parsed.data.participantId!,
          eventTeamId: resolvedTeamId,
        },
        select: { id: true },
      })
      if (existing) return { error: "Teilnehmer ist bereits in diesem Team eingeschrieben." }
    } else {
      // Einzel-Modus: nur einmal pro Wettbewerb
      const existing = await db.competitionParticipant.findFirst({
        where: { competitionId, participantId: parsed.data.participantId!, eventTeamId: null },
        select: { id: true },
      })
      if (existing) return { error: "Teilnehmer ist bereits in diesem Wettbewerb eingeschrieben." }
    }

    await db.competitionParticipant.create({
      data: {
        competitionId,
        participantId: parsed.data.participantId!,
        startNumber: parsed.data.startNumber,
        isGuest: false,
        disciplineId: parsed.data.disciplineId,
        eventTeamId: resolvedTeamId,
      },
    })
  }

  await revalidateCompetitionParticipantPaths(competitionId)
  return { success: true }
}
