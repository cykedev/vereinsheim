import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { SCORING_COOKIE } from "@/lib/device-cookie"

/** Wertung des Geräts merken (ein Jahr); Liste und Start lesen sie beim nächsten Laden auf dem Server */
export function rememberScoring(scoring: Scoring) {
  document.cookie = `${SCORING_COOKIE}=${scoring}; path=/; max-age=31536000; samesite=lax`
}
