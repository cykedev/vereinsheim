// Die Datei eines Belegs über HTTP (`GET /api/evidence/<id>`): `Request` hinein, `Response` heraus, ohne Next, wie bei
// den Ausdrucken (`printouts/http.ts`). Nur für den Besitzer einer sichtbaren Scheibe, nie auf der geteilten Seite; sonst
// 404, ohne zu sagen, ob es den Beleg gibt. Ein Bild läuft in einer Sandbox, ohne Skripte.

import type { Db } from "@/lib/db"

import { VISIBLE_CARD } from "../db/visible"
import { EVIDENCE_ID, EVIDENCE_TYPES, readEvidenceBytes, type EvidenceType } from "./files"

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
/** ein Bild in einer Sandbox ohne Skripte; ein PDF ohne, sonst zeigt Chrome es nicht an (wie die Ausdrucke) */
const sandboxFor = (type: EvidenceType): Record<string, string> =>
  type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }

const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

const isEvidenceType = (value: string): value is EvidenceType =>
  Object.hasOwn(EVIDENCE_TYPES, value)

/** ein Wert nach RFC 5987: `encodeURIComponent` lässt `'()*` stehen, die dort nicht erlaubt sind */
const rfc5987 = (value: string) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )

/**
 * Der Kopf `Content-Disposition`: `beleg.<Endung>` für alte Browser, dazu der Name der Datei in UTF-8, damit ein
 * Speichern aus dem Viewer ihn trägt; ohne Namen nur `beleg.<Endung>`
 */
export function contentDisposition(type: EvidenceType, name: string | null): string {
  const plain = `inline; filename="beleg.${EVIDENCE_TYPES[type]}"`
  return name ? `${plain}; filename*=UTF-8''${rfc5987(name)}` : plain
}

/** die Datei eines Belegs, nur für den Besitzer und nur, wo die Seite der Scheibe sie zeigt; sonst null */
export async function evidenceFile(
  db: Db,
  evidenceId: string,
  ownerId: string
): Promise<{ bytes: Buffer; type: EvidenceType; name: string | null } | null> {
  const row = await db.cardEvidence.findFirst({
    where: { id: evidenceId, card: { is: { ownerId, ...VISIBLE_CARD } } },
    select: { sha256: true, contentType: true, fileName: true },
  })
  if (!row || !isEvidenceType(row.contentType)) return null
  const bytes = await readEvidenceBytes(row.sha256, row.contentType)
  if (!bytes) {
    console.error("Beleg ohne Datei")
    return null
  }
  return { bytes, type: row.contentType, name: row.fileName }
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
      ...sandboxFor(file.type),
      "Content-Type": file.type,
      "Content-Disposition": contentDisposition(file.type, file.name),
      "Content-Length": String(file.bytes.length),
    },
  })
}
