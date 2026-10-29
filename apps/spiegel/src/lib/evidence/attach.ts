// Einen Beleg in der Transaktion des Aufrufers anhängen (Action `attachEvidence` und Übernahme aus Treffsicher): unter
// der Sperre der Scheibe, nur an eine eigene, sichtbare, unter der Grenze und jede Datei nur einmal je Scheibe. Die Datei
// liegt dann schon unter `UPLOAD_DIR/evidence/` (`writeEvidenceFile`).

import type { Prisma } from "@/generated/prisma/client"

import { lockCard } from "../db/purge"
import { VISIBLE_CARD } from "../db/visible"
import type { EvidenceType } from "./files"
import { EVIDENCE_LIMIT, type EvidenceProblem } from "./texts"

export type Attached = "attached" | "gone" | "limit" | EvidenceProblem

export async function attachEvidenceIn(
  tx: Prisma.TransactionClient,
  data: {
    cardId: string
    ownerId: string
    sha256: string
    type: EvidenceType
    size: number
    fileName: string | null
  }
): Promise<Attached> {
  const { cardId, ownerId, sha256 } = data
  if (!(await lockCard(tx, cardId))) return "gone"
  const card = await tx.card.findFirst({
    where: { id: cardId, ownerId, ...VISIBLE_CARD },
    select: { _count: { select: { evidence: true } } },
  })
  if (!card) return "gone"
  if (card._count.evidence >= EVIDENCE_LIMIT) return "limit"
  if (await tx.cardEvidence.findFirst({ where: { cardId, sha256 }, select: { id: true } }))
    return "duplicate"
  await tx.cardEvidence.create({
    data: { cardId, sha256, contentType: data.type, size: data.size, fileName: data.fileName },
  })
  return "attached"
}
