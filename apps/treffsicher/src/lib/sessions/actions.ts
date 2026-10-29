"use server"

import {
  createSessionAction,
  deleteSessionAction,
  getSessionByIdAction,
  getSessionsAction,
  toggleFavouriteAction,
  updateSessionAction,
} from "@/lib/sessions/actions/sessionActions"
import { previewMeytonImportAction } from "@/lib/sessions/actions/meytonActions"
import {
  uploadAttachmentAction,
  deleteAttachmentAction,
} from "@/lib/sessions/actions/attachmentActions"
import {
  saveFeedbackAction,
  savePrognosisAction,
  saveReflectionAction,
  saveWellbeingAction,
} from "@/lib/sessions/actions/mentalActions"
import { refuseIfMoved } from "@/lib/moved/guard"
import type {
  ActionResult,
  MeytonImportPreviewResult,
  SessionDetail,
  SessionWithDiscipline,
} from "@/lib/sessions/actions/types"

export type {
  ActionResult,
  MeytonImportPreview,
  MeytonImportPreviewHitLocation,
  MeytonImportPreviewResult,
  MeytonImportPreviewSeries,
  SerializedPrognosis,
  SerializedSeries,
  SessionDetail,
  SessionGoalSummary,
  SessionWithDiscipline,
} from "@/lib/sessions/actions/types"

// Öffentliche Fassade für Session-Server-Actions: UI importiert nur dieses Modul statt Unterpfaden.
export async function createSession(formData: FormData): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return createSessionAction(formData)
}

export async function previewMeytonImport(formData: FormData): Promise<MeytonImportPreviewResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return previewMeytonImportAction(formData)
}

export async function getSessionById(id: string): Promise<SessionDetail | null> {
  return getSessionByIdAction(id)
}

export async function getSessions(): Promise<SessionWithDiscipline[]> {
  return getSessionsAction()
}

export async function uploadAttachment(
  sessionId: string,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return uploadAttachmentAction(sessionId, formData)
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return deleteAttachmentAction(attachmentId)
}

export async function updateSession(id: string, formData: FormData): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return updateSessionAction(id, formData)
}

export async function toggleFavourite(sessionId: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return toggleFavouriteAction(sessionId)
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return deleteSessionAction(id)
}

export async function saveWellbeing(
  sessionId: string,
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return saveWellbeingAction(sessionId, prevState, formData)
}

export async function saveReflection(
  sessionId: string,
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return saveReflectionAction(sessionId, prevState, formData)
}

export async function savePrognosis(
  sessionId: string,
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return savePrognosisAction(sessionId, prevState, formData)
}

export async function saveFeedback(
  sessionId: string,
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return saveFeedbackAction(sessionId, prevState, formData)
}
