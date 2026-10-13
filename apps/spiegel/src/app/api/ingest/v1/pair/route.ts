import { db } from "@/lib/db"
import { handlePair } from "@/lib/ingest/http"

// Ingest-API v1: Kopplung mit Einmal-Code (ohne Token) (`src/lib/ingest/http.ts`, Vertrag `@vereinsheim/ingest-contract/api`)
export const dynamic = "force-dynamic"

export function POST(request: Request) {
  return handlePair(request, {
    db,
    trustProxyHeaders: process.env.AUTH_TRUST_PROXY_HEADERS === "true",
  })
}
