import { cookies } from "next/headers"

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { SCORING_COOKIE } from "@/lib/device-cookie"

/** die Wertung des Geräts beim Laden einer Seite; ohne Wahl Zehntel */
export async function deviceScoring(): Promise<Scoring> {
  return (await cookies()).get(SCORING_COOKIE)?.value === "rings" ? "rings" : "decimal"
}
