"use server"

import {
  getGoalByIdAction,
  getGoalsForSelectionAction,
  getGoalsWithAssignmentsAction,
  getGoalSessionOptionsAction,
} from "@/lib/goals/actions/getGoals"
import {
  createGoalAction,
  createGoalAndRedirectAction,
  deleteGoalAction,
  updateGoalAction,
  updateGoalAssignmentsAction,
} from "@/lib/goals/actions/mutateGoals"
import { refuseIfMoved } from "@/lib/moved/guard"
import { redirect } from "next/navigation"
import type {
  ActionResult,
  GoalForSelection,
  GoalSessionOption,
  GoalWithAssignments,
} from "@/lib/goals/types"

export type {
  ActionResult,
  GoalForSelection,
  GoalSessionOption,
  GoalWithAssignments,
} from "@/lib/goals/types"

// Öffentliche Goal-Fassade bündelt Query- und Mutationspfade für UI und Server Components.
export async function getGoalsWithAssignments(): Promise<GoalWithAssignments[]> {
  return getGoalsWithAssignmentsAction()
}

export async function getGoalById(goalId: string): Promise<GoalWithAssignments | null> {
  return getGoalByIdAction(goalId)
}

export async function getGoalSessionOptions(): Promise<GoalSessionOption[]> {
  return getGoalSessionOptionsAction()
}

export async function getGoalsForSelection(): Promise<GoalForSelection[]> {
  return getGoalsForSelectionAction()
}

export async function createGoal(formData: FormData): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return createGoalAction(formData)
}

export async function createGoalAndRedirect(formData: FormData): Promise<void> {
  // gibt nichts zurück: die Ablehnung zeigt die Seite „Das geht jetzt in Spiegel.“
  if (await refuseIfMoved()) redirect("/goals/new")
  return createGoalAndRedirectAction(formData)
}

export async function updateGoal(goalId: string, formData: FormData): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return updateGoalAction(goalId, formData)
}

export async function updateGoalAssignments(
  goalId: string,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return updateGoalAssignmentsAction(goalId, formData)
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return deleteGoalAction(goalId)
}
