"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatTimeOfDay } from "@vereinsheim/lib/format"

import { adminActor } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { createPairing, revokeBridge } from "@/lib/ingest/bridges"
import type { ActionResult } from "@/lib/types"

// Admin → Anlage (SP-1.6 b): Anlage anlegen und ändern, Brücke koppeln und widerrufen, Ranglisten (eine neue Epoche
// bestätigt kein Admin mehr, P2c D0: das ist Technik, keine Entscheidung)
// (Zustimmungen per Sportpass: `src/lib/consent/actions.ts`). Jede Action prüft selbst (`adminActor`) und gibt ein
// ActionResult zurück.

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
  timeZone: z
    .string()
    .trim()
    .refine(isTimeZone, "Diese Zeitzone kennt Spiegel nicht. In Deutschland: Europe/Berlin."),
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
  const site = await db.site.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, timeZone: true },
  })
  // fest, sobald Scheiben da sind: Jeder spätere Stand einer Scheibe rechnete mit der neuen Zone, verschöbe ihre Uhrzeit
  // und gälte als Korrektur (Review P2c)
  if (
    site &&
    parsed.data.timeZone !== site.timeZone &&
    (await db.card.count({ where: { source: { siteId: site.id } } })) > 0
  )
    return {
      error: {
        timeZone: ["Die Zeitzone lässt sich nicht mehr ändern, weil schon Scheiben da sind."],
      },
    }
  if (site) await db.site.update({ where: { id: site.id }, data: parsed.data })
  else await db.site.create({ data: parsed.data })
  revalidatePath("/admin/site")
  revalidatePath("/admin")
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
  if (!site) return { error: "Richte zuerst die Meyton-Anlage ein." }
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
  if (!Number.isSafeInteger(bridgeId))
    return { error: "Diese Brücke gibt es nicht mehr. Lade die Seite neu." }
  await revokeBridge(db, bridgeId)
  revalidatePath("/admin/site")
  revalidatePath("/admin")
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
  if (!Number.isSafeInteger(rankingId))
    return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
  if (!(RANKING_KINDS as readonly string[]).includes(kind))
    return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
  try {
    const updated = await db.ranking.updateMany({
      where: { id: rankingId },
      data: { kind: kind === "open" ? null : (kind as "training" | "competition") },
    })
    if (updated.count === 0)
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
  } catch {
    return { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
  }
  // Liste, Start und Fortschritt rechnen die Art beim Lesen
  revalidatePath("/", "layout")
  return { success: true }
}
