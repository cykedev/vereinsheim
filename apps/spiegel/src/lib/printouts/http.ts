// Die Datei eines Ausdrucks über HTTP (`GET /api/printouts/<id>`): `Request` hinein, `Response` heraus, ohne Next,
// damit ein Test sie ohne Server prüft (Muster der Ingest-API). Nur für den Besitzer und nur, wo die Seite der Scheibe sie
// zeigt (`printoutFile`); sonst 404, ohne zu sagen, ob es den Ausdruck gibt.

import type { Db } from "@/lib/db"

import { printoutFile } from "./queries"

/** die Form einer Kennung aus `cuid()`; alles andere fragt die Datenbank gar nicht erst */
const PRINTOUT_ID = /^c[a-z0-9]{20,}$/

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }

const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

/** die Antwort auf den Abruf eines Ausdrucks; `userId` null ohne Sitzung */
export async function printoutResponse(
  db: Db,
  printoutId: string,
  userId: string | null
): Promise<Response> {
  if (!userId) return status(401)
  if (!PRINTOUT_ID.test(printoutId)) return status(404)
  const file = await printoutFile(db, printoutId, userId)
  if (!file) return status(404)
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ausdruck-${file.hex ?? "ohne-id"}.pdf"`,
      "Content-Length": String(file.bytes.length),
    },
  })
}
