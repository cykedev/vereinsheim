import { db } from "@/lib/db"
import { handleSnapshots } from "@/lib/ingest/http"

// Ingest-API v1: Stapel von Snapshots v1 (`src/lib/ingest/http.ts`, Vertrag `@vereinsheim/ingest-contract/api`)
export const dynamic = "force-dynamic"

export function POST(request: Request) {
  return handleSnapshots(request, {
    db,
    trustProxyHeaders: process.env.AUTH_TRUST_PROXY_HEADERS === "true",
  })
}
