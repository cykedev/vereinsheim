"use server"

import { revalidatePath } from "next/cache"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import {
  addCard,
  clearSection,
  createForCard,
  createFromEvening,
  createWithout,
  releaseCard,
  setBasics,
  setExecution,
  setExpected,
  setOutcome,
  setScale,
  setText,
  takeQuestion,
  type DiarySection,
} from "./entries"
import type { ScalePart, Stage } from "./scales"
import { diarySettings } from "./settings"
import { ERRORS, NEW_TEXTS } from "./texts"
import { TEXT_FIELDS, type TextField } from "./validation"

// Aus dem Browser: Sitzung, Tagebuch eingeschaltet, Kennungen der Form nach; die Regeln stehen in `entries.ts`.

/** das eigene Konto mit eingeschaltetem Tagebuch und die Anzeige-Zone; sonst der Grund */
async function guard(): Promise<{ userId: string; timeZone: string } | { error: string }> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  if (!(await diarySettings(db, userId)).enabled) return { error: ERRORS.off }
  return { userId, timeZone: getDisplayTimeZone() }
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64 && /^[a-z0-9]+$/i.test(value)

/** Fehler als Ergebnis; sonst die Seiten des Tagebuchs neu, mit `everywhere` auch Start und die Scheiben */
function done(error: string | null, everywhere = false): ActionResult {
  if (error) return { error }
  revalidatePath(everywhere ? "/" : "/diary", "layout")
  return { success: true }
}

export async function createEntryFromEvening(
  day: string,
  familyId: number
): Promise<ActionResult<{ id: string }>> {
  const g = await guard()
  if ("error" in g) return g
  if (typeof day !== "string" || !isRowId(familyId)) return { error: ERRORS.failed }
  const result = await createFromEvening(db, g.userId, { day, familyId, timeZone: g.timeZone })
  if ("error" in result) return result
  revalidatePath("/", "layout")
  return { success: true, data: { id: result.id } }
}

/** „Eintrag anlegen“ an einer Scheibe: legt an (oder findet den Eintrag) und nennt das Ziel für den Browser */
export async function createEntryForCard(
  cardId: string
): Promise<ActionResult<{ href: string; toast?: string }>> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(cardId)) return { error: ERRORS.missing }
  const result = await createForCard(db, g.userId, cardId, g.timeZone)
  if ("error" in result) return result
  revalidatePath("/", "layout")
  return { success: true, data: { href: `/diary/${result.id}`, toast: NEW_TEXTS.created } }
}

export async function createEntryWithout(input: {
  day: string
  kind: string
  familyId: number | null
}): Promise<ActionResult<{ id: string }>> {
  const g = await guard()
  if ("error" in g) return g
  if (typeof input !== "object" || input === null) return { error: ERRORS.failed }
  const { day, kind, familyId } = input
  if (
    typeof day !== "string" ||
    typeof kind !== "string" ||
    (familyId !== null && !isRowId(familyId))
  )
    return { error: ERRORS.failed }
  const result = await createWithout(db, g.userId, { day, kind, familyId, timeZone: g.timeZone })
  if ("error" in result) return result
  revalidatePath("/", "layout")
  return { success: true, data: { id: result.id } }
}

export async function addEntryCard(entryId: string, cardId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId) || !isId(cardId)) return { error: ERRORS.missing }
  return done(await addCard(db, g.userId, entryId, cardId, g.timeZone), true)
}

export async function releaseEntryCard(entryId: string, cardId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId) || !isId(cardId)) return { error: ERRORS.missing }
  return done(await releaseCard(db, g.userId, entryId, cardId, g.timeZone), true)
}

export async function saveEntryText(
  entryId: string,
  field: TextField,
  value: string
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId) || !TEXT_FIELDS.includes(field)) return { error: ERRORS.missing }
  return done(await setText(db, g.userId, entryId, field, value))
}

export async function saveExpected(entryId: string, value: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await setExpected(db, g.userId, entryId, value))
}

export async function saveOutcome(entryId: string, outcome: string | null): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await setOutcome(db, g.userId, entryId, outcome))
}

export async function saveScale(
  entryId: string,
  part: ScalePart,
  aspect: string,
  stage: Stage | null
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await setScale(db, g.userId, entryId, { part, aspect, stage }))
}

export async function saveExecution(
  entryId: string,
  cardId: string,
  series: number,
  stage: Stage | null
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId) || !isId(cardId) || !Number.isSafeInteger(series))
    return { error: ERRORS.missing }
  return done(
    await setExecution(db, g.userId, entryId, { cardId, series, stage, timeZone: g.timeZone })
  )
}

export async function clearEntrySection(
  entryId: string,
  section: DiarySection
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await clearSection(db, g.userId, entryId, section))
}

export async function takeThreadQuestion(entryId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await takeQuestion(db, g.userId, entryId))
}

export async function saveEntryBasics(
  entryId: string,
  input: { day: string; kind: string; familyId: number | null }
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(entryId)) return { error: ERRORS.missing }
  return done(await setBasics(db, g.userId, entryId, { ...input, timeZone: g.timeZone }), true)
}
