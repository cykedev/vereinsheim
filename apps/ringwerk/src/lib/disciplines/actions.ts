"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"

const DisciplineSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
  scoringType: z.enum(["WHOLE", "DECIMAL"] as const, { message: "Ungültige Wertungsart" }),
  teilerFaktor: z
    .number({ message: "Teiler-Faktor muss eine Zahl sein" })
    .min(0.001, "Teiler-Faktor muss mindestens 0.001 sein")
    .max(9.999, "Teiler-Faktor darf maximal 9.999 sein"),
})

function revalidateDisciplinePaths(): void {
  revalidatePath("/disciplines")
  revalidatePath("/disciplines", "layout")
}

export async function createDiscipline(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const parsed = DisciplineSchema.safeParse({
    name: formData.get("name"),
    scoringType: formData.get("scoringType"),
    teilerFaktor: Number(formData.get("teilerFaktor")),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const newDiscipline = await db.discipline.create({
    data: parsed.data,
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "DISCIPLINE_CREATED" satisfies AuditEventType,
      entityType: "DISCIPLINE",
      entityId: newDiscipline.id,
      userId: session.user.id,
      details: {
        name: parsed.data.name,
        scoringType: parsed.data.scoringType,
        teilerFaktor: parsed.data.teilerFaktor,
      },
    },
  })

  revalidateDisciplinePaths()
  return { success: true }
}

export async function updateDiscipline(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true, scoringType: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  const parsed = DisciplineSchema.safeParse({
    name: formData.get("name"),
    scoringType: formData.get("scoringType"),
    teilerFaktor: Number(formData.get("teilerFaktor")),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  if (parsed.data.scoringType !== discipline.scoringType) {
    // Wertungsartwechsel verhindert inkonsistente historische Ergebnisse
    const competitionCount = await db.competition.count({ where: { disciplineId: id } })
    if (competitionCount > 0) {
      return {
        error:
          "Wertungsart kann nicht geändert werden — die Disziplin wird bereits in Wettbewerben verwendet.",
      }
    }
  }

  await db.discipline.update({ where: { id }, data: parsed.data })

  await db.auditLog.create({
    data: {
      eventType: "DISCIPLINE_UPDATED" satisfies AuditEventType,
      entityType: "DISCIPLINE",
      entityId: id,
      userId: session.user.id,
      details: {
        name: parsed.data.name,
        scoringType: parsed.data.scoringType,
        teilerFaktor: parsed.data.teilerFaktor,
      },
    },
  })

  revalidateDisciplinePaths()
  return { success: true }
}

export async function setDisciplineArchived(id: string, archive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true, name: true, isArchived: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }
  if (discipline.isArchived === archive) return { success: true }

  await db.discipline.update({ where: { id }, data: { isArchived: archive } })

  if (archive) {
    await db.auditLog.create({
      data: {
        eventType: "DISCIPLINE_ARCHIVED" satisfies AuditEventType,
        entityType: "DISCIPLINE",
        entityId: id,
        userId: session.user.id,
        details: { name: discipline.name },
      },
    })
  }

  revalidateDisciplinePaths()
  return { success: true }
}

export async function deleteDiscipline(id: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true, name: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  // Endgültiges Löschen nur ohne Wettbewerbsverwendung, damit keine FK-Verweise brechen
  const competitionCount = await db.competition.count({ where: { disciplineId: id } })
  if (competitionCount > 0) {
    return { error: "Disziplin kann nicht gelöscht werden — sie wird in Wettbewerben verwendet." }
  }

  await db.auditLog.create({
    data: {
      eventType: "DISCIPLINE_DELETED" satisfies AuditEventType,
      entityType: "DISCIPLINE",
      entityId: id,
      userId: session.user.id,
      details: { name: discipline.name },
    },
  })

  await db.discipline.delete({ where: { id } })
  revalidateDisciplinePaths()
  return { success: true }
}
