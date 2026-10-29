"use server"

import { createHash } from "node:crypto"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import type { Prisma } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"
import { sweepUploadsSoon } from "@/lib/uploads"

import { lockCard } from "../db/purge"
import { VISIBLE_CARD } from "../db/visible"
import { storePrintout } from "../printouts/store"
import { EVIDENCE_ID, evidenceTypeOf, writeEvidenceFile } from "./files"
import { evidenceFileName } from "./name"
import { isPdfFile } from "./shrink"
import {
  EVIDENCE_GONE,
  EVIDENCE_LIMIT,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_NO_SESSION,
  EVIDENCE_REMOVE_FAILED,
  evidenceName,
  evidenceProblemText,
  limitText,
  type EvidenceProblem,
} from "./texts"

// Belege einer eigenen Scheibe ([[adr-033]], Nachtrag 1f): bis zu `EVIDENCE_LIMIT` Fotos oder PDFs an jeder sichtbaren
// Scheibe des Besitzers, gleich welcher Herkunft. Ein Beleg ist keine Angabe der Scheibe: Die Actions schreiben nur
// `CardEvidence`, nie eine Revision. Der Typ zählt an den Bytes, nie am Namen. Ein PDF, in dem Spiegel einen
// Meyton-Ausdruck erkennt, wird kein Beleg: Unter „Scheibe holen“ bringt es seine Werte mit. Der Browser schickt jede
// Datei in einer eigenen Anfrage. Die Actions prüfen selbst und werfen nie; ins Log nur der Name eines Fehlers.

/** eine eigene, sichtbare Scheibe */
const ownCard = (cardId: string, ownerId: string): Prisma.CardWhereInput => ({
  id: cardId,
  ownerId,
  ...VISIBLE_CARD,
})

type Attached = "attached" | "gone" | "limit" | EvidenceProblem

/** in einer Transaktion unter der Sperre der Scheibe: sichtbar und eigen, unter der Grenze, die Datei noch nicht dran */
async function attachRow(
  ownerId: string,
  data: {
    cardId: string
    sha256: string
    contentType: string
    size: number
    fileName: string | null
  }
): Promise<Attached> {
  return db.$transaction(async (tx) => {
    if (!(await lockCard(tx, data.cardId))) return "gone"
    const card = await tx.card.findFirst({
      where: ownCard(data.cardId, ownerId),
      select: { _count: { select: { evidence: true } } },
    })
    if (!card) return "gone"
    if (card._count.evidence >= EVIDENCE_LIMIT) return "limit"
    if (
      await tx.cardEvidence.findFirst({
        where: { cardId: data.cardId, sha256: data.sha256 },
        select: { id: true },
      })
    )
      return "duplicate"
    await tx.cardEvidence.create({ data })
    return "attached"
  })
}

/** ein Foto oder PDF an eine eigene Scheibe hängen. Felder `cardId` und `file`; der Fehler ist ein fertiger Satz */
export async function attachEvidence(form: FormData): Promise<ActionResult> {
  let name = "Datei"
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: EVIDENCE_NO_SESSION }
    const cardId = form.get("cardId")
    if (!isCardIdInput(cardId)) return { error: EVIDENCE_GONE }
    const file = form.get("file")
    if (!(file instanceof File)) return { error: evidenceProblemText("unreadable", name) }
    const fileName = evidenceFileName(file.name)
    name = evidenceName({ name: fileName, kind: isPdfFile(file) ? "pdf" : "photo" })
    if (file.size === 0) return { error: evidenceProblemText("unreadable", name) }
    // die Größe vor dem Lesen: Eine zu große Datei kommt gar nicht erst in den Speicher
    if (file.size > EVIDENCE_MAX_BYTES) return { error: evidenceProblemText("tooLarge", name) }
    // ohne Sperre, damit eine volle Scheibe die Datei gar nicht erst liest; verbindlich zählt `attachRow`
    const card = await db.card.findFirst({
      where: ownCard(cardId, ownerId),
      select: { _count: { select: { evidence: true } } },
    })
    if (!card) return { error: EVIDENCE_GONE }
    if (card._count.evidence >= EVIDENCE_LIMIT) return { error: limitText([name]) }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = evidenceTypeOf(bytes)
    if (!type) return { error: evidenceProblemText("unreadable", name) }
    name = evidenceName({ name: fileName, kind: type === "application/pdf" ? "pdf" : "photo" })

    // ein Meyton-Ausdruck hat ID und Druckzeit im Fuß; größer als ein Ausdruck sein kann, ist keiner
    if (type === "application/pdf" && bytes.length <= DEFAULT_LIMITS.maxBytes) {
      const read = await storePrintout({ bytes, timeZone: getDisplayTimeZone() }, { write: false })
      if (read.kind === "stored") return { error: evidenceProblemText("printout", name) }
      if (read.reason === "busy" || read.reason === "timeout" || read.reason === "nodeVersion")
        return { error: evidenceProblemText("failed", name) }
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex")
    await writeEvidenceFile(sha256, type, bytes)
    const result = await attachRow(ownerId, {
      cardId,
      sha256,
      contentType: type,
      size: bytes.length,
      fileName,
    })
    if (result === "attached") return { success: true }
    if (result === "gone") return { error: EVIDENCE_GONE }
    if (result === "limit") return { error: limitText([name]) }
    return { error: evidenceProblemText(result, name) }
  } catch (error) {
    console.error(
      "Beleg nicht angehängt:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: evidenceProblemText("failed", name) }
  }
}

/** einen Beleg einer eigenen, sichtbaren Scheibe entfernen; die Datei räumt das Aufräumen ab, wenn keine Zeile mehr auf sie zeigt */
export async function removeEvidence(evidenceId: string): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: EVIDENCE_NO_SESSION }
    if (typeof evidenceId !== "string" || !EVIDENCE_ID.test(evidenceId))
      return { error: EVIDENCE_GONE }
    const { count } = await db.cardEvidence.deleteMany({
      where: { id: evidenceId, card: { is: { ownerId, ...VISIBLE_CARD } } },
    })
    if (!count) return { error: EVIDENCE_GONE }
    sweepUploadsSoon(db)
    return { success: true }
  } catch (error) {
    console.error(
      "Beleg nicht entfernt:",
      error instanceof Error ? error.name : "unbekannter Fehler"
    )
    return { error: EVIDENCE_REMOVE_FAILED }
  }
}
