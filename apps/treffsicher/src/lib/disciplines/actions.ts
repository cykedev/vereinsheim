"use server"

import type { Discipline } from "@/generated/prisma/client"
import { setFavouriteDisciplineAction } from "@/lib/disciplines/actions/favouriteDiscipline"
import {
  getDisciplineByIdAction,
  getDisciplineForDetailAction,
  getDisciplineUsageAction,
  getDisciplinesAction,
  getDisciplinesForManagementAction,
  getFavouriteDisciplineIdAction,
  getHiddenDisciplineIdsAction,
} from "@/lib/disciplines/actions/getDisciplines"
import { toggleHiddenDisciplineAction } from "@/lib/disciplines/actions/hideDiscipline"
import {
  archiveDisciplineAction,
  createDisciplineAction,
  deleteDisciplineAction,
  setDisciplineArchivedAction,
  updateDisciplineAction,
} from "@/lib/disciplines/actions/mutateDiscipline"
import { refuseDisciplineIfMoved, refuseIfMoved } from "@/lib/moved/guard"
import type { ActionResult, DisciplineUsage } from "@/lib/disciplines/types"

export type { ActionResult } from "@/lib/disciplines/types"

// Öffentliche Disziplin-Fassade hält Seiten/Komponenten frei von internen Action-Dateipfaden.
export async function getDisciplines(): Promise<Discipline[]> {
  return getDisciplinesAction()
}

export async function getDisciplinesForManagement(): Promise<Discipline[]> {
  return getDisciplinesForManagementAction()
}

export async function getDisciplineForDetail(id: string): Promise<Discipline | null> {
  return getDisciplineForDetailAction(id)
}

export async function getDisciplineUsage(id: string): Promise<DisciplineUsage | null> {
  return getDisciplineUsageAction(id)
}

export async function getFavouriteDisciplineId(): Promise<string | null> {
  return getFavouriteDisciplineIdAction()
}

export async function setFavouriteDiscipline(disciplineId: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return setFavouriteDisciplineAction(disciplineId)
}

export async function getHiddenDisciplineIds(): Promise<string[]> {
  return getHiddenDisciplineIdsAction()
}

export async function toggleHiddenDiscipline(disciplineId: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return toggleHiddenDisciplineAction(disciplineId)
}

export async function createDiscipline(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseDisciplineIfMoved({ isSystem: formData.get("isSystem") === "true" })
  if (refused) return refused
  return createDisciplineAction(prevState, formData)
}

export async function getDisciplineById(id: string): Promise<Discipline | null> {
  return getDisciplineByIdAction(id)
}

export async function updateDiscipline(
  id: string,
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseDisciplineIfMoved({ id })
  if (refused) return refused
  return updateDisciplineAction(id, prevState, formData)
}

export async function archiveDiscipline(id: string): Promise<ActionResult> {
  const refused = await refuseDisciplineIfMoved({ id })
  if (refused) return refused
  return archiveDisciplineAction(id)
}

export async function setDisciplineArchived(
  id: string,
  nextArchived: boolean
): Promise<ActionResult> {
  const refused = await refuseDisciplineIfMoved({ id })
  if (refused) return refused
  return setDisciplineArchivedAction(id, nextArchived)
}

export async function deleteDiscipline(id: string): Promise<ActionResult> {
  const refused = await refuseDisciplineIfMoved({ id })
  if (refused) return refused
  return deleteDisciplineAction(id)
}
