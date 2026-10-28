"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"

import { isCardIdInput, isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { CardKind } from "@/generated/prisma/client"
import type { ActionResult } from "@/lib/types"

import { requestSiteId } from "../card-requests/queries"
import { writeEnteredCard } from "../db/entered"
import { formToDetails, problemText, startedAtOf, TEXTS, type EnteredFormState } from "./form"
import { cardForEdit, entryDiscipline } from "./queries"

// „Ergebnis eintragen“ ([[adr-033]]): eine Scheibe von Hand anlegen oder eine eingetragene ändern. Die Action prüft
// selbst, schreibt nur über `writeEnteredCard` (Herkunft `manual`) und gibt Fehler je Feld zurück; sie wirft nie.

const GONE = "Diese Scheibe gibt es nicht mehr."
const MAX_ROWS = 100

const text = (max: number) => z.string().max(max)
const FormSchema = z.object({
  day: text(10),
  time: text(5),
  place: text(400),
  values: z.enum(["decimal", "rings"]),
  result: z.enum(["series", "total"]),
  series: z
    .array(z.object({ sum: text(12), open: z.boolean(), shots: z.array(text(12)).max(MAX_ROWS) }))
    .max(MAX_ROWS),
  total: text(12),
  totalShots: text(6),
  center: z.object({
    x: text(12),
    xDir: z.enum(["left", "right"]),
    y: text(12),
    yDir: z.enum(["up", "down"]),
  }),
})

const fieldErrors = (errors: Record<string, string>) => ({
  error: Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]])),
})

/**
 * Eine Scheibe von Hand speichern. Neu: mit Disziplin (wählbar auf der Anlage) und Art; ändern: eine eigene,
 * eingetragene Scheibe, Disziplin und Art bleiben. Die Werte werden eine neue Revision, wenn sie sich ändern; Tag,
 * Uhrzeit und Ort stehen an der Scheibe.
 */
export async function saveEnteredCard(input: {
  cardId?: string
  disciplineId?: number
  kind?: CardKind
  form: EnteredFormState
}): Promise<ActionResult<{ cardId: string }>> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    const parsed = FormSchema.safeParse(input?.form)
    if (!parsed.success) return { error: TEXTS.reload }
    const form = parsed.data
    const timeZone = getDisplayTimeZone()

    let target: { cardId?: string; disciplineId: number; kind: CardKind; kindChoice?: CardKind }
    let discipline
    if (input.cardId !== undefined) {
      if (!isCardIdInput(input.cardId)) return { error: GONE }
      const card = await cardForEdit(db, { cardId: input.cardId, ownerId, timeZone })
      if (!card) return { error: GONE }
      discipline = card.discipline
      target = { cardId: card.id, disciplineId: card.discipline.id, kind: card.kind }
    } else {
      const { disciplineId, kind } = input
      if (!isRowId(disciplineId) || (kind !== "training" && kind !== "competition"))
        return { error: TEXTS.reload }
      const siteId = await requestSiteId(db)
      discipline = siteId === null ? null : await entryDiscipline(db, { siteId, disciplineId })
      if (!discipline) return { error: TEXTS.reload }
      target = { disciplineId, kind, kindChoice: kind }
    }

    const today = formatIsoDate(new Date(), timeZone)
    const when = startedAtOf(form.day, form.time, timeZone, today)
    const details = formToDetails(form, discipline)
    if (!when.ok || !details.ok)
      return fieldErrors({ ...(when.ok ? {} : when.errors), ...(details.ok ? {} : details.errors) })

    const result = await writeEnteredCard(db, {
      ...target,
      ownerId,
      origin: "manual",
      startedAtMs: when.startedAtMs,
      timeUnknown: when.timeUnknown,
      place: form.place,
      details: details.details,
      reason: target.cardId ? "von Hand geändert" : "von Hand eingetragen",
    })
    switch (result.kind) {
      case "saved":
        revalidatePath("/", "layout")
        return { success: true, data: { cardId: result.cardId } }
      case "missing":
        return { error: target.cardId ? GONE : TEXTS.reload }
      case "notEditable":
        return { error: TEXTS.notEditable }
      case "keyTaken":
        return { error: TEXTS.reload }
      case "invalid": {
        const { field, text } = problemText(result.problem)
        return field ? fieldErrors({ [field]: text }) : { error: text }
      }
    }
  } catch (error) {
    console.error(
      "Scheibe von Hand nicht gespeichert:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
  }
}
