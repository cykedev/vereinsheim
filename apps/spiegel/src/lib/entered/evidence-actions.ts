"use server"

import { createHash } from "node:crypto"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import type { Prisma } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { VISIBLE_CARD } from "../db/visible"
import { evidenceTypeOf, writeEvidenceFile } from "../evidence/files"
import { EVIDENCE_MAX_BYTES, EVIDENCE_TEXTS } from "../evidence/texts"
import { storePrintout } from "../printouts/store"

// Beleg einer eingetragenen Scheibe ([[adr-033]]): ein Foto oder PDF je Scheibe, im Kasten „Diese Scheibe“. Der Typ zählt
// an den Bytes, nie am Namen. Ein PDF, in dem Spiegel einen Meyton-Ausdruck erkennt, wird kein Beleg: Unter „Scheibe
// holen“ bringt es seine Werte mit. Die Actions prüfen selbst und werfen nie; ins Log nur der Name eines Fehlers.

const GONE = "Diese Scheibe gibt es nicht mehr."

/** eine eigene, sichtbare, eingetragene Scheibe */
const ownEntered = (cardId: string, ownerId: string): Prisma.CardWhereInput => ({
  id: cardId,
  ownerId,
  ...VISIBLE_CARD,
  origin: { in: ["manual", "treffsicher"] },
})

/** ein Foto oder PDF an eine eingetragene Scheibe hängen; ersetzt einen früheren Beleg. Felder `cardId` und `file` */
export async function attachEvidence(form: FormData): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    const cardId = form.get("cardId")
    if (!isCardIdInput(cardId)) return { error: GONE }
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) return { error: EVIDENCE_TEXTS.unreadable }
    // die Größe vor dem Lesen: Eine zu große Datei kommt gar nicht erst in den Speicher
    if (file.size > EVIDENCE_MAX_BYTES) return { error: EVIDENCE_TEXTS.tooLarge }
    if (!(await db.card.findFirst({ where: ownEntered(cardId, ownerId), select: { id: true } })))
      return { error: GONE }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = evidenceTypeOf(bytes)
    if (!type) return { error: EVIDENCE_TEXTS.unreadable }

    // ein Meyton-Ausdruck hat ID und Druckzeit im Fuß; größer als ein Ausdruck sein kann, ist keiner
    if (type === "application/pdf" && bytes.length <= DEFAULT_LIMITS.maxBytes) {
      const read = await storePrintout({ bytes, timeZone: getDisplayTimeZone() }, { write: false })
      if (read.kind === "stored") return { error: EVIDENCE_TEXTS.printout }
      if (read.reason === "busy" || read.reason === "timeout" || read.reason === "nodeVersion")
        return { error: EVIDENCE_TEXTS.failed }
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex")
    await writeEvidenceFile(sha256, type, bytes)
    const saved = await db.$transaction(async (tx) => {
      const card = await tx.card.findFirst({
        where: ownEntered(cardId, ownerId),
        select: { id: true },
      })
      if (!card) return false
      const data = { sha256, contentType: type, size: bytes.length, storedAt: new Date() }
      await tx.cardEvidence.deleteMany({ where: { cardId } })
      await tx.cardEvidence.create({ data: { cardId, ...data } })
      return true
    })
    return saved ? { success: true } : { error: GONE }
  } catch (error) {
    console.error(
      "Beleg nicht angehängt:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: EVIDENCE_TEXTS.failed }
  }
}

/** den Beleg einer eigenen, eingetragenen Scheibe entfernen; die Datei räumt das Aufräumen später ab */
export async function removeEvidence(cardId: string): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: GONE }
    const { count } = await db.cardEvidence.deleteMany({
      where: { cardId, card: ownEntered(cardId, ownerId) },
    })
    return count ? { success: true } : { error: GONE }
  } catch (error) {
    console.error(
      "Beleg nicht entfernt:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: EVIDENCE_TEXTS.failed }
  }
}
