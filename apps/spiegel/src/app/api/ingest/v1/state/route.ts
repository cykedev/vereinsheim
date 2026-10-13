import { db } from "@/lib/db"
import { handleState } from "@/lib/ingest/http"

// Ingest-API v1: Zustand für die Brücke ohne eigenen Zustand (`src/lib/ingest/http.ts`, Vertrag `@vereinsheim/ingest-contract/api`)
export const dynamic = "force-dynamic"

export function GET(request: Request) {
  return handleState(request, {
    db,
    trustProxyHeaders: process.env.AUTH_TRUST_PROXY_HEADERS === "true",
  })
}
