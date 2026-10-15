"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { adminActor, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { NOT_MINE } from "@/lib/db/purge"
import type { ActionResult } from "@/lib/types"

import { MAX_CONSENTS_PER_ACCOUNT } from "./status"
import { CURRENT_CONSENT_VERSION } from "./texts"

// Zustimmung per Sportpass (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D6): Der Schütze stimmt im Profil zu
// und widerruft dort; ein Admin bestätigt, lehnt ab oder entfernt. Erst bestätigt lädt die Brücke hoch. Jede Action
// prüft selbst und gibt ein ActionResult zurück.

const RequestSchema = z.object({
  sportpass: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "Eine Sportpassnummer hat höchstens zwölf Ziffern.")
    // Zod prüft weiter, auch wenn das Muster schon nicht passt: erst die Ziffern, dann die Zahl
    .refine(
      (value) => !/^\d+$/.test(value) || BigInt(value) > BigInt(0),
      "Bitte eine gültige Sportpassnummer eingeben."
    ),
  agree: z.literal("on", { error: "Bitte setz das Häkchen, wenn du zustimmst." }),
})

const isConsentId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0

function revalidateConsents(userId?: string) {
  revalidatePath("/profile")
  revalidatePath("/admin")
  revalidatePath("/admin/users")
  if (userId) revalidatePath(`/admin/users/${userId}`)
}

/** gilt die Zustimmung einem anderen Text als dem, der jetzt gilt (neue Version zwischen Anzeige und Absenden) */
const STALE_TEXT = "Der Hinweis hat sich geändert. Bitte die Seite neu laden und neu lesen."

/** die Grenze je Konto hielt nicht: ein anderer Aufruf desselben Kontos war schneller (Sperre der Kontozeile) */
class LimitReached extends Error {}

/**
 * Der Schütze stimmt dem Hinweistext für eine SportpassID zu; danach wartet sie auf den Admin. Das Formular schickt die
 * Version des gezeigten Texts mit: So belegt die Zeile genau den gelesenen Wortlaut (Review).
 */
export async function requestSportpass(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
  if (formData.get("version") !== CURRENT_CONSENT_VERSION) return { error: STALE_TEXT }
  const parsed = RequestSchema.safeParse({
    sportpass: formData.get("sportpass") ?? "",
    agree: formData.get("agree") ?? "",
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  // das sieht ein Schütze: keine Aufgabe des Admins nennen (Review P2f)
  if (!site)
    return {
      error:
        "Spiegel ist noch nicht mit der Meyton-Anlage verbunden. Bitte wende dich an einen Admin.",
    }
  const sportpassId = BigInt(parsed.data.sportpass)
  try {
    // Zählen und Anlegen in einer Transaktion unter der Sperre der Kontozeile: gleichzeitige Aufrufe desselben Kontos
    // warten aufeinander, die Grenze hält ([[conventions]] §9, Review)
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      if ((await tx.sportpassConsent.count({ where: { userId } })) >= MAX_CONSENTS_PER_ACCOUNT)
        throw new LimitReached()
      await tx.sportpassConsent.create({
        data: {
          userId,
          siteId: site.id,
          sportpassId,
          consentedAt: new Date(),
          consentVersion: CURRENT_CONSENT_VERSION,
        },
      })
    })
  } catch (error) {
    if (error instanceof LimitReached)
      return {
        error: {
          sportpass: ["Du hast schon eine Sportpassnummer. Für eine neue widerrufe erst die alte."],
        },
      }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // die eigene sagt das; wem eine fremde gehört, sagt die Meldung nicht
      const own = await db.sportpassConsent.count({
        where: { siteId: site.id, sportpassId, userId },
      })
      return {
        error: {
          sportpass: [
            own
              ? "Diese Sportpassnummer steht schon in deinem Profil."
              : "Diese Sportpassnummer hat schon jemand eingetragen. Wende dich an einen Admin.",
          ],
        },
      }
    }
    throw error
  }
  revalidateConsents(userId)
  return { success: true }
}

/**
 * Widerruf (oder Entfernen einer Ablehnung): nur die eigene. Die Scheiben bleiben beim Schützen, er löscht sie selbst
 * (User, 14. Oktober 2026); ab dem nächsten `GET /state` lädt die Brücke nichts mehr (SF-38).
 */
export async function revokeSportpass(consentId: number): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
  if (!isConsentId(consentId))
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  const { count } = await db.sportpassConsent.deleteMany({ where: { id: consentId, userId } })
  if (count === 0)
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  revalidateConsents(userId)
  return { success: true }
}

/** eine Entscheidung des Admins: nur, solange sie noch offen ist (Bedingung im Befehl selbst) */
async function decide(
  consentId: number,
  where: Prisma.SportpassConsentWhereInput,
  data: Prisma.SportpassConsentUpdateManyMutationInput
): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isConsentId(consentId))
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true },
  })
  if (!consent)
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  const { count } = await db.sportpassConsent.updateMany({
    where: { id: consentId, ...where },
    data,
  })
  if (count === 0) return { error: "Das hat gerade schon jemand entschieden. Lade die Seite neu." }
  revalidateConsents(consent.userId)
  return { success: true }
}

/** bestätigen (auch eine zurückgegebene); danach lädt die Brücke hoch */
export async function confirmConsent(consentId: number): Promise<ActionResult> {
  return decide(
    consentId,
    { confirmedAt: null, rejectedAt: null },
    // ein neuer Auftrag zum Nachladen, falls er offen ist (Review P2d)
    { confirmedAt: new Date(), returnedAt: null, historyRequestedAt: new Date() }
  )
}

/** ablehnen, auch eine schon bestätigte; danach lädt die Brücke nichts mehr */
export async function rejectConsent(consentId: number): Promise<ActionResult> {
  return decide(consentId, { rejectedAt: null }, { rejectedAt: new Date(), confirmedAt: null })
}

/** entfernen, in jedem Zustand */
export async function removeConsent(consentId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isConsentId(consentId))
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true },
  })
  if (!consent)
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  await db.sportpassConsent.deleteMany({ where: { id: consentId } })
  revalidateConsents(consent.userId)
  return { success: true }
}

/**
 * Meldungen „nicht meine“ der Nummer einer Zustimmung aufheben (P2d, D8): Die Grabsteine dieser Anlage und SportpassID
 * gehen, die Brücke holt die Scheiben nach (`historyLoadedAt` null), und sie warten in „Offen“, bis der Schütze sie
 * bestätigt (`firstCardConfirmedAt` null). Andere Grabsteine bleiben.
 */
export async function liftNotMine(consentId: number): Promise<ActionResult> {
  const actor = await adminActor()
  if ("error" in actor) return actor
  if (!isConsentId(consentId))
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true, siteId: true, sportpassId: true },
  })
  if (!consent)
    return { error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu." }
  let lifted: number
  try {
    lifted = await db.$transaction(async (tx) => {
      const { count } = await tx.tombstone.deleteMany({
        where: {
          source: { siteId: consent.siteId },
          sportpassId: consent.sportpassId,
          reason: NOT_MINE,
        },
      })
      if (count > 0)
        await tx.sportpassConsent.updateMany({
          where: { id: consentId },
          // ein neuer Auftrag: Die Brücke liest auch, was sie in diesem Lauf schon gemeldet hat (Review P2d)
          data: {
            historyLoadedAt: null,
            historyRequestedAt: new Date(),
            firstCardConfirmedAt: null,
          },
        })
      return count
    })
  } catch {
    return { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
  }
  if (lifted === 0) return { error: "Unter dieser Nummer ist keine Scheibe mehr zurückgewiesen." }
  revalidateConsents(consent.userId)
  return { success: true }
}
