import { db } from "@/lib/db"
import { handleHeartbeat } from "@/lib/ingest/http"

// Ingest-API v1: Lebenszeichen der Brücke, einmal je Minute (`src/lib/ingest/http.ts`, Vertrag `@vereinsheim/ingest-contract/api`)
export const dynamic = "force-dynamic"

export function POST(request: Request) {
  return handleHeartbeat(request, {
    db,
    trustProxyHeaders: process.env.AUTH_TRUST_PROXY_HEADERS === "true",
  })
}
