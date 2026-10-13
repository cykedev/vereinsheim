"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatTimeOfDay } from "@vereinsheim/lib/format"

import { Prisma } from "@/generated/prisma/client"
import { adminActor } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { createPairing, revokeBridge } from "@/lib/ingest/bridges"
import type { ActionResult } from "@/lib/types"

// Admin → Anlage (SP-1.6 b): Anlage anlegen und ändern, Brücke koppeln und widerrufen, Epoche bestätigen,
// SportpassIDs mit Zustimmung an einem Konto. Jede Action prüft selbst (`adminActor`) und gibt ein ActionResult zurück.

const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: value })
    return true
  } catch {
    return false
  }
}

const SiteSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(80, "Höchstens 80 Zeichen."),
  timeZone: z.string().trim().refine(isTimeZone, "Unbekannte Zeitzone, etwa Europe/Berlin."),
})

export async function saveSite(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  const parsed = SiteSchema.safeParse({
    name: formData.get("name") ?? "",
    timeZone: formData.get("timeZone") ?? "",
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (site) await db.site.update({ where: { id: site.id }, data: parsed.data })
  else await db.site.create({ data: parsed.data })
  revalidatePath("/admin/site")
  return { success: true }
}

const PairSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(64, "Höchstens 64 Zeichen."),
})

/** ein Kopplungscode; er steht nur in dieser Antwort, gespeichert ist sein Hash */
export async function pairBridge(
  _previous: ActionResult<{ code: string; until: string }> | null,
  formData: FormData
): Promise<ActionResult<{ code: string; until: string }>> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  const parsed = PairSchema.safeParse({ name: formData.get("name") ?? "" })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (!site) return { error: "Zuerst die Anlage anlegen." }
  const pairing = await createPairing(db, {
    siteId: site.id,
    name: parsed.data.name,
    createdById: actor.id,
  })
  return {
    success: true,
    data: { code: pairing.code, until: formatTimeOfDay(pairing.expiresAt, getDisplayTimeZone()) },
  }
}

export async function revokeBridgeAction(bridgeId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!Number.isSafeInteger(bridgeId)) return { error: "Unbekannte Brücke." }
  await revokeBridge(db, bridgeId)
  revalidatePath("/admin/site")
  return { success: true }
}

/** eine neue Epoche der Quelle bestätigen (Ablage geleert, neuer Server; SF-23) */
export async function confirmEpoch(sourceId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!Number.isSafeInteger(sourceId)) return { error: "Unbekannte Epoche." }
  await db.source.updateMany({
    where: { id: sourceId, confirmedAt: null },
    data: { confirmedAt: new Date() },
  })
  revalidatePath("/admin/site")
  return { success: true }
}

const SportpassSchema = z.object({
  sportpass: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "Eine SportpassID hat bis zu zwölf Ziffern.")
    // Zod prüft weiter, auch wenn das Muster schon nicht passt: erst die Ziffern, dann die Zahl
    .refine(
      (value) => !/^\d+$/.test(value) || BigInt(value) > BigInt(0),
      "Eine SportpassID ist größer als 0."
    ),
})

/**
 * Eine SportpassID mit Zustimmung an ein Konto (bis SP-1.7 a trägt sie der Admin nach der Zustimmung auf Papier ein).
 * Eine SportpassID gehört an einer Anlage höchstens einem Konto ([[spiegel-assignment]]).
 */
export async function addSportpass(
  userId: string,
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  const parsed = SportpassSchema.safeParse({ sportpass: formData.get("sportpass") ?? "" })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const [site, user] = await Promise.all([
    db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } }),
    db.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ])
  if (!site) return { error: "Zuerst die Anlage anlegen." }
  if (!user) return { error: "Unbekanntes Konto." }
  try {
    await db.sportpassConsent.create({
      data: {
        userId,
        siteId: site.id,
        sportpassId: BigInt(parsed.data.sportpass),
        confirmedAt: new Date(),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { error: { sportpass: ["Diese SportpassID gehört schon zu einem Konto."] } }
    throw error
  }
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function removeSportpass(consentId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!Number.isSafeInteger(consentId)) return { error: "Unbekannte Zustimmung." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true },
  })
  if (!consent) return { error: "Unbekannte Zustimmung." }
  await db.sportpassConsent.deleteMany({ where: { id: consentId } })
  revalidatePath(`/admin/users/${consent.userId}`)
  return { success: true }
}

const RANKING_KINDS = ["training", "competition", "open"] as const

/**
 * Art einer Rangliste („RWK_…“ ist Wettkampf); `open` hebt die Zuordnung auf. Gilt beim Lesen für jede Scheibe der
 * Rangliste, deren Art der Schütze nicht selbst gewählt hat ([[meyton-ssmdb2]]: `Status` ist an der Anlage leer).
 */
export async function setRankingKind(rankingId: number, kind: string): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!Number.isSafeInteger(rankingId)) return { error: "Unbekannte Rangliste." }
  if (!(RANKING_KINDS as readonly string[]).includes(kind)) return { error: "Unbekannte Art." }
  const updated = await db.ranking.updateMany({
    where: { id: rankingId },
    data: { kind: kind === "open" ? null : (kind as "training" | "competition") },
  })
  if (updated.count === 0) return { error: "Unbekannte Rangliste." }
  // Liste, Start und Fortschritt rechnen die Art beim Lesen
  revalidatePath("/", "layout")
  return { success: true }
}
