import { cookies } from "next/headers"

import type { Scoring } from "@vereinsheim/shot-core/metrics"

/** Wertung des Geräts (U2): Zehntel oder ganze Ringe, in Profil gewählt, als Cookie, damit der Server sie kennt */
export const SCORING_COOKIE = "spiegel-scoring"

export async function deviceScoring(): Promise<Scoring> {
  return (await cookies()).get(SCORING_COOKIE)?.value === "rings" ? "rings" : "decimal"
}
