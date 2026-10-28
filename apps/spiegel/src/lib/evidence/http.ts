// Die Datei eines Belegs über HTTP (`GET /api/evidence/<id>`): `Request` hinein, `Response` heraus, ohne Next, wie bei
// den Ausdrucken (`printouts/http.ts`). Nur für den Besitzer einer sichtbaren Scheibe, nie auf der geteilten Seite; sonst
// 404, ohne zu sagen, ob es den Beleg gibt. Das Bild oder PDF läuft in einer Sandbox, ohne Skripte.

import type { Db } from "@/lib/db"

import { VISIBLE_CARD } from "../db/visible"
import { EVIDENCE_TYPES, readEvidenceBytes, type EvidenceType } from "./files"

/** die Form einer Kennung aus `cuid()`; alles andere fragt die Datenbank gar nicht erst */
const EVIDENCE_ID = /^c[a-z0-9]{20,}$/

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox",
}

const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

const isEvidenceType = (value: string): value is EvidenceType =>
  Object.hasOwn(EVIDENCE_TYPES, value)

/** die Datei eines Belegs, nur für den Besitzer und nur, wo die Seite der Scheibe sie zeigt; sonst null */
export async function evidenceFile(
  db: Db,
  evidenceId: string,
  ownerId: string
): Promise<{ bytes: Buffer; type: EvidenceType } | null> {
  const row = await db.cardEvidence.findFirst({
    where: { id: evidenceId, card: { is: { ownerId, ...VISIBLE_CARD } } },
    select: { sha256: true, contentType: true },
  })
  if (!row || !isEvidenceType(row.contentType)) return null
  const bytes = await readEvidenceBytes(row.sha256, row.contentType)
  if (!bytes) {
    console.error("Beleg ohne Datei")
    return null
  }
  return { bytes, type: row.contentType }
}

/** die Antwort auf den Abruf eines Belegs; `userId` null ohne Sitzung */
export async function evidenceResponse(
  db: Db,
  evidenceId: string,
  userId: string | null
): Promise<Response> {
  if (!userId) return status(401)
  if (!EVIDENCE_ID.test(evidenceId)) return status(404)
  const file = await evidenceFile(db, evidenceId, userId)
  if (!file) return status(404)
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="beleg.${EVIDENCE_TYPES[file.type]}"`,
      "Content-Length": String(file.bytes.length),
    },
  })
}
