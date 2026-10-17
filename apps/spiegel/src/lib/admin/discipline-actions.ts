"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import { TARGETS } from "@vereinsheim/shot-core/targets"

import { adminActor } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { moveDisciplineFamily, refreshStaleDisciplineCards } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

import { disciplineRecalculates, type DisciplineMapping } from "./consequences"
import { familySlug } from "./discipline-model"

// Admin → Disziplinen: eine Disziplin einordnen oder ignorieren, Familien anlegen, umbenennen und entfernen. Jede Action
// prüft selbst (`adminActor`), arbeitet auf der ersten Anlage (ADR-029) und gibt ein ActionResult zurück.

const RELOAD = "Das ließ sich nicht speichern. Bitte lade die Seite neu."

/** Kennung einer Zeile mit `Int`-Spalte: darüber würfe Prisma, statt die Meldung zu geben */
const isRowId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647

const MappingSchema = z.object({
  targetId: z.string().refine((value) => value === "own" || value in TARGETS),
  familyId: z.number().int().positive().max(2_147_483_647).nullable(),
  officialScoring: z.enum(["decimal", "rings", "open"]),
  plannedShots: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("id") }),
    z.object({ mode: z.literal("open") }),
    z.object({ mode: z.literal("count"), count: z.number().int().min(1).max(200) }),
  ]),
})

/** die Zuordnung, wie sie in der Zeile steht */
type MappingRow = {
  targetId: string | null
  familyId: number | null
  officialScoring: "decimal" | "rings" | null
  plannedShots: number | null
  confirmedAt: Date | null
  ignoredAt: Date | null
}

const mappingOf = (row: MappingRow): DisciplineMapping => ({
  targetId: row.targetId,
  familyId: row.familyId,
  officialScoring: row.officialScoring,
  plannedShots: row.plannedShots,
  confirmed: row.confirmedAt !== null,
})

/** die Scheiben der Disziplin im Hintergrund nachrechnen; ins Log nur der Name eines Fehlers */
function refreshLater() {
  after(() =>
    refreshStaleDisciplineCards(db).catch((error: unknown) =>
      console.error(
        "Scheiben nach einer Zuordnung nicht nachgerechnet:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
  )
}

const firstSite = () => db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })

/**
 * Eine Disziplin einordnen: Scheibe, Familie, Wertung im Wettkampf, Schusszahl. Ändern sich Scheibe oder Schusszahl
 * (gegen die gesperrte Zeile, nie gegen das, was der Browser zuvor sah), steigt die Version, und Spiegel rechnet die
 * Scheiben danach im Hintergrund nach. Eine ignorierte Disziplin hat kein Formular.
 */
export async function saveDiscipline(
  disciplineId: number,
  input: {
    targetId: string
    familyId: number | null
    officialScoring: "decimal" | "rings" | "open"
    plannedShots: { mode: "id" } | { mode: "open" } | { mode: "count"; count: number }
  }
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  const parsed = MappingSchema.safeParse(input)
  if (!isRowId(disciplineId) || !parsed.success) return { error: RELOAD }
  const site = await firstSite()
  if (!site) return { error: RELOAD }
  const wanted = parsed.data
  const next = {
    targetId: wanted.targetId === "own" ? null : wanted.targetId,
    familyId: wanted.familyId,
    officialScoring: wanted.officialScoring === "open" ? null : wanted.officialScoring,
    plannedShots:
      wanted.plannedShots.mode === "id"
        ? null
        : wanted.plannedShots.mode === "open"
          ? 0
          : wanted.plannedShots.count,
  }
  try {
    const saved = await db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<MappingRow[]>`
        SELECT "targetId", "familyId", "officialScoring", "plannedShots", "confirmedAt", "ignoredAt"
          FROM "Discipline" WHERE id = ${disciplineId} AND "siteId" = ${site.id} FOR UPDATE`
      if (!row || row.ignoredAt) return false
      if (next.familyId !== null && !(await tx.family.findUnique({ where: { id: next.familyId } })))
        return false
      const before = mappingOf(row)
      const recalculates = disciplineRecalculates(before, { ...before, ...next })
      await tx.discipline.update({
        where: { id: disciplineId },
        data: {
          targetId: next.targetId,
          officialScoring: next.officialScoring,
          plannedShots: next.plannedShots,
          confirmedAt: new Date(),
          ...(recalculates ? { version: { increment: 1 } } : {}),
        },
      })
      if (row.familyId !== next.familyId)
        await moveDisciplineFamily(tx, disciplineId, next.familyId)
      return true
    })
    if (!saved) return { error: RELOAD }
  } catch {
    return { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
  }
  refreshLater()
  revalidatePath("/", "layout")
  return { success: true }
}

/**
 * Eine Disziplin ignorieren oder wieder zeigen; gilt beim Lesen, nichts wird nachgerechnet. Wieder gezeigt ohne Scheibe
 * oder Familie steht sie wieder unter „Neu“.
 */
export async function setDisciplineIgnored(
  disciplineId: number,
  ignored: boolean
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isRowId(disciplineId) || typeof ignored !== "boolean") return { error: RELOAD }
  const site = await firstSite()
  if (!site) return { error: RELOAD }
  const discipline = await db.discipline.findFirst({
    where: { id: disciplineId, siteId: site.id },
    select: { targetId: true, familyId: true },
  })
  if (!discipline) return { error: RELOAD }
  const placed = discipline.targetId !== null && discipline.familyId !== null
  const now = new Date()
  const { count } = await db.discipline.updateMany({
    where: { id: disciplineId, siteId: site.id },
    data: ignored
      ? { ignoredAt: now, confirmedAt: now }
      : { ignoredAt: null, confirmedAt: placed ? now : null },
  })
  if (count === 0) return { error: RELOAD }
  revalidatePath("/", "layout")
  return { success: true }
}

const FamilyName = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(40, "Höchstens 40 Zeichen.")

/** gibt es den Namen schon (ohne Groß- und Kleinschreibung), außer bei der Familie selbst */
async function nameTaken(name: string, except?: number) {
  const same = await db.family.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(except ? { NOT: { id: except } } : {}),
    },
    select: { id: true },
  })
  return same !== null
}

/** eine eigene Familie anlegen; die Kennung entsteht aus dem Namen und bleibt fest */
export async function createFamily(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  const parsed = FamilyName.safeParse(formData.get("name") ?? "")
  if (!parsed.success) return { error: { name: parsed.error.issues.map((i) => i.message) } }
  const name = parsed.data
  if (await nameTaken(name)) return { error: { name: ["Diesen Namen hat schon eine Familie."] } }
  try {
    const taken = (await db.family.findMany({ select: { slug: true } })).map((f) => f.slug)
    await db.family.create({ data: { name, slug: familySlug(name, taken) } })
  } catch {
    return { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
  }
  revalidatePath("/admin/disciplines")
  return { success: true }
}

/** eine Familie umbenennen; die Kennung in der Adresse bleibt */
export async function renameFamily(familyId: number, name: string): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isRowId(familyId)) return { error: RELOAD }
  const parsed = FamilyName.safeParse(name)
  if (!parsed.success) return { error: { name: parsed.error.issues.map((i) => i.message) } }
  if (await nameTaken(parsed.data, familyId))
    return { error: { name: ["Diesen Namen hat schon eine Familie."] } }
  const { count } = await db.family.updateMany({
    where: { id: familyId },
    data: { name: parsed.data },
  })
  if (count === 0) return { error: RELOAD }
  revalidatePath("/", "layout")
  return { success: true }
}

/** eine Familie ohne Disziplinen und ohne Scheiben entfernen; die Bedingung steht im Löschbefehl selbst */
export async function removeFamily(familyId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isRowId(familyId)) return { error: RELOAD }
  const { count } = await db.family.deleteMany({
    where: { id: familyId, disciplines: { none: {} }, cards: { none: {} } },
  })
  if (count === 0)
    return {
      error: "Zu dieser Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.",
    }
  revalidatePath("/", "layout")
  return { success: true }
}
