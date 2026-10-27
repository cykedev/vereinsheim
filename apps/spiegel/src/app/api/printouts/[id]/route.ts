import { shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { printoutResponse } from "@/lib/printouts/http"

// Die Datei eines Ausdrucks, nur für den Besitzer der Scheibe (`src/lib/printouts/http.ts`); die Anmeldung prüft schon
// `proxy.ts`
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return printoutResponse(db, id, await shooterId())
}
