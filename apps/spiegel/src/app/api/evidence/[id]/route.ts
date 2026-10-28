import { shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { evidenceResponse } from "@/lib/evidence/http"

// Die Datei eines Belegs, nur für den Besitzer der Scheibe (`src/lib/evidence/http.ts`); die Anmeldung prüft schon
// `proxy.ts`
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return evidenceResponse(db, id, await shooterId())
}
