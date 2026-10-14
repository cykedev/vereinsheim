"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { adminActor, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { CURRENT_CONSENT_VERSION } from "./texts"

// Zustimmung per Sportpass (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D6): Der Schütze stimmt im Profil zu
// und widerruft dort; ein Admin bestätigt, lehnt ab oder entfernt. Erst bestätigt lädt die Brücke hoch. Jede Action
// prüft selbst und gibt ein ActionResult zurück.

/** SF-39 braucht mehrere je Konto (neuer Ausweis); mehr als drei ist kein Anwendungsfall */
const MAX_PER_ACCOUNT = 3

const RequestSchema = z.object({
  sportpass: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "Eine SportpassID hat bis zu zwölf Ziffern.")
    // Zod prüft weiter, auch wenn das Muster schon nicht passt: erst die Ziffern, dann die Zahl
    .refine(
      (value) => !/^\d+$/.test(value) || BigInt(value) > BigInt(0),
      "Eine SportpassID ist größer als 0."
    ),
  agree: z.literal("on", { error: "Bitte dem Hinweis zustimmen." }),
})

const isConsentId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0

function revalidateConsents(userId?: string) {
  revalidatePath("/profile")
  revalidatePath("/admin/users")
  if (userId) revalidatePath(`/admin/users/${userId}`)
}

/** der Schütze stimmt dem Hinweistext für eine SportpassID zu; danach wartet sie auf den Admin */
export async function requestSportpass(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: "Nicht angemeldet" }
  const parsed = RequestSchema.safeParse({
    sportpass: formData.get("sportpass") ?? "",
    agree: formData.get("agree") ?? "",
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (!site) return { error: "Spiegel ist noch nicht eingerichtet." }
  if ((await db.sportpassConsent.count({ where: { userId } })) >= MAX_PER_ACCOUNT)
    return { error: { sportpass: ["Höchstens drei SportpassIDs je Konto."] } }
  try {
    await db.sportpassConsent.create({
      data: {
        userId,
        siteId: site.id,
        sportpassId: BigInt(parsed.data.sportpass),
        consentedAt: new Date(),
        consentVersion: CURRENT_CONSENT_VERSION,
      },
    })
  } catch (error) {
    // wem sie gehört, sagt die Meldung nicht
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return {
        error: {
          sportpass: ["Diese SportpassID ist schon vergeben. Wende dich an einen Admin."],
        },
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
  if (!userId) return { error: "Nicht angemeldet" }
  if (!isConsentId(consentId)) return { error: "Unbekannte Zustimmung." }
  const { count } = await db.sportpassConsent.deleteMany({ where: { id: consentId, userId } })
  if (count === 0) return { error: "Unbekannte Zustimmung." }
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
  if (!isConsentId(consentId)) return { error: "Unbekannte Zustimmung." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true },
  })
  if (!consent) return { error: "Unbekannte Zustimmung." }
  const { count } = await db.sportpassConsent.updateMany({
    where: { id: consentId, ...where },
    data,
  })
  if (count === 0) return { error: "Schon entschieden." }
  revalidateConsents(consent.userId)
  return { success: true }
}

/** bestätigen (auch eine zurückgegebene); danach lädt die Brücke hoch */
export async function confirmConsent(consentId: number): Promise<ActionResult> {
  return decide(
    consentId,
    { confirmedAt: null, rejectedAt: null },
    { confirmedAt: new Date(), returnedAt: null }
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
  if (!isConsentId(consentId)) return { error: "Unbekannte Zustimmung." }
  const consent = await db.sportpassConsent.findUnique({
    where: { id: consentId },
    select: { userId: true },
  })
  if (!consent) return { error: "Unbekannte Zustimmung." }
  await db.sportpassConsent.deleteMany({ where: { id: consentId } })
  revalidateConsents(consent.userId)
  return { success: true }
}
