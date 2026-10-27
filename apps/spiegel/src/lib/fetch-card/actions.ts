"use server"

import { revalidatePath } from "next/cache"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { parseCardId } from "../card-requests/id"
import { dismissRequest, requestSiteId } from "../card-requests/queries"
import { fetchPrintout } from "../printouts/fetch"
import { storePrintout, type StoredPrintout } from "../printouts/store"
import { fetchCard, type NewCardChoice } from "./queries"
import { fetchErrorText, type FetchOutcome, type FetchProblem } from "./texts"

// Scheibe holen ([[spiegel-assignment]]): Link aus dem QR, ein hochgeladenes PDF oder die getippte ID mit Tag. Jede
// Action prüft selbst, gibt ein ActionResult zurück und wirft nie; ins Log kommt nur der Name eines Fehlers.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ID_ERROR = "Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck."
const DAY_ERROR = "Bitte den Tag der Scheibe wählen, nicht nach heute."

/** ein Tag, den es gibt, nicht nach heute (in der Anzeige-Zone) */
function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !ISO_DAY.test(day)) return false
  const at = new Date(`${day}T12:00:00Z`)
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) return false
  return day <= formatIsoDate(new Date(), getDisplayTimeZone())
}

/** Disziplin und Art aus dem Browser; null ohne Wahl, `false`, wenn sie nicht stimmt */
function choiceOf(choice: unknown): NewCardChoice | null | false {
  if (choice === null || choice === undefined) return null
  if (typeof choice !== "object") return false
  const { disciplineId, kind } = choice as Record<string, unknown>
  if (!isRowId(disciplineId) || (kind !== "training" && kind !== "competition")) return false
  return { disciplineId, kind }
}

const problem = (reason: FetchProblem): { error: string } => ({ error: fetchErrorText(reason) })

type Source =
  | { file: StoredPrintout | null; scheibenId: number; hex: string; day: string }
  | { error: string | Record<string, string[]> }

/** ein gelesener Ausdruck als Quelle: ID und Abend aus dem PDF */
async function printoutSource(
  bytes: Uint8Array,
  fileName: string | null,
  timeZone: string
): Promise<Source> {
  const stored = await storePrintout({ bytes, timeZone, fileName })
  if (stored.kind === "rejected") return problem(stored.reason)
  const { file } = stored
  return {
    file,
    scheibenId: file.scheibenId,
    hex: file.hex,
    day: eveningDay(file.printedAt.getTime(), timeZone),
  }
}

/** der gemeinsame Weg: Konto, Anlage, Quelle, dann `fetchCard` */
async function fetchFrom(
  source: (timeZone: string) => Promise<Source>,
  rawChoice: unknown
): Promise<ActionResult<FetchOutcome>> {
  try {
    const userId = await shooterId()
    if (!userId) return problem("noSession")
    const choice = choiceOf(rawChoice)
    if (choice === false) return problem("notAllowed")
    const siteId = await requestSiteId(db)
    if (siteId === null) return problem("noSite")
    const { timeZone } = await db.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { timeZone: true },
    })
    const got = await source(timeZone)
    if ("error" in got) return got
    const result = await fetchCard(db, {
      userId,
      siteId,
      scheibenId: got.scheibenId,
      day: got.day,
      file: got.file,
      choice,
    })
    switch (result.kind) {
      case "choose":
        return {
          success: true,
          data: { kind: "choose", hex: got.hex, day: got.day, relifts: result.relifts },
        }
      case "taken":
      case "blocked":
      case "tooMany":
      case "notAllowed":
      case "trashExpired":
        return problem(result.kind)
    }
    revalidatePath("/", "layout")
    if (result.kind === "created")
      return { success: true, data: { kind: "created", cardId: result.cardId } }
    return { success: true, data: result }
  } catch (error) {
    console.error(
      "Scheibe nicht geholt:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return problem("failed")
  }
}

/** über den Link aus dem QR-Code */
export async function fetchCardByLink(
  url: string,
  choice: NewCardChoice | null
): Promise<ActionResult<FetchOutcome>> {
  return fetchFrom(async (timeZone) => {
    if (typeof url !== "string") return problem("badUrl")
    const fetched = await fetchPrintout(url)
    if (fetched.kind === "failed") return problem(fetched.reason)
    return printoutSource(fetched.bytes, fetched.fileName, timeZone)
  }, choice)
}

/** über ein hochgeladenes PDF; Felder `file`, dazu wahlweise `disciplineId` und `kind` */
export async function fetchCardByUpload(form: FormData): Promise<ActionResult<FetchOutcome>> {
  const disciplineId = Number(form.get("disciplineId"))
  const kind = form.get("kind")
  const choice = form.has("disciplineId") || form.has("kind") ? { disciplineId, kind } : null
  return fetchFrom(async (timeZone) => {
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) return problem("notPdf")
    // die Größe vor dem Lesen: Ein zu großes PDF kommt gar nicht erst in den Speicher
    if (file.size > DEFAULT_LIMITS.maxBytes) return problem("tooLarge")
    const bytes = new Uint8Array(await file.arrayBuffer())
    return printoutSource(bytes, file.name, timeZone)
  }, choice)
}

/** über die ID vom Ausdruck und den Tag der Scheibe */
export async function fetchCardById(
  id: string,
  day: string,
  choice: NewCardChoice | null
): Promise<ActionResult<FetchOutcome>> {
  return fetchFrom(async () => {
    const parsed = typeof id === "string" ? parseCardId(id) : null
    const errors: Record<string, string[]> = {}
    if (!parsed) errors.id = [ID_ERROR]
    if (!validDay(day)) errors.day = [DAY_ERROR]
    if (!parsed || Object.keys(errors).length) return { error: errors }
    return { file: null, scheibenId: parsed.scheibenId, hex: parsed.hex, day }
  }, choice)
}

/** einen eigenen, ungefüllten Auftrag beenden („Nicht mehr holen“, „Entfernen“); Scheibe und Ausdruck bleiben */
export async function stopCardFetch(requestId: number): Promise<ActionResult> {
  try {
    const userId = await shooterId()
    if (!userId) return problem("noSession")
    if (!isRowId(requestId) || !(await dismissRequest(db, { userId, requestId })))
      return { error: "Spiegel holt diese Scheibe schon nicht mehr. Lade die Seite neu." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    console.error(
      "Auftrag nicht beendet:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: "Das ließ sich nicht ändern. Versuche es noch einmal." }
  }
}
