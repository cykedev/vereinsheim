"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { ParticipantSchema, revalidateParticipantPaths } from "./_shared"

export async function createParticipant(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const parsed = ParticipantSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contact: formData.get("contact"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const contact = parsed.data.contact ?? null

  if (contact) {
    const existing = await db.participant.findUnique({ where: { contact }, select: { id: true } })
    if (existing) return { error: "Diese Kontaktangabe wird bereits verwendet." }
  }

  const newParticipant = await db.participant.create({
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      contact,
      createdByUserId: session.user.id,
    },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "PARTICIPANT_CREATED" satisfies AuditEventType,
      entityType: "PARTICIPANT",
      entityId: newParticipant.id,
      userId: session.user.id,
      details: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}

export async function updateParticipant(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({ where: { id }, select: { id: true } })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }

  const parsed = ParticipantSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contact: formData.get("contact"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const contact = parsed.data.contact ?? null

  if (contact) {
    const contactConflict = await db.participant.findFirst({
      where: { contact, NOT: { id } },
      select: { id: true },
    })
    if (contactConflict) return { error: "Diese Kontaktangabe wird bereits verwendet." }
  }

  await db.participant.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      contact,
    },
  })

  await db.auditLog.create({
    data: {
      eventType: "PARTICIPANT_UPDATED" satisfies AuditEventType,
      entityType: "PARTICIPANT",
      entityId: id,
      userId: session.user.id,
      details: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}

export async function setParticipantActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }
  if (participant.isActive === isActive) return { success: true }

  if (!isActive) {
    const activeEnrollments = await db.competitionParticipant.count({
      where: { participantId: id, status: "ACTIVE", competition: { status: "ACTIVE" } },
    })
    if (activeEnrollments > 0) {
      return {
        error:
          "Teilnehmer hat aktive Meisterschafts-Einschreibungen und kann nicht deaktiviert werden. Bitte zuerst zurückziehen.",
      }
    }
  }

  await db.participant.update({ where: { id }, data: { isActive } })

  const eventType: AuditEventType = isActive ? "PARTICIPANT_REACTIVATED" : "PARTICIPANT_DEACTIVATED"
  await db.auditLog.create({
    data: {
      eventType,
      entityType: "PARTICIPANT",
      entityId: id,
      userId: session.user.id,
      details: {
        firstName: participant.firstName,
        lastName: participant.lastName,
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}
