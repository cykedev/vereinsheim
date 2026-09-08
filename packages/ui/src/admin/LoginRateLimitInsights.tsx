import { formatInteger } from "@vereinsheim/lib/format"
import type { AdminLoginRateLimitInsights } from "@vereinsheim/lib/auth/rate-limit/adminTypes"

import { Badge } from "../ui/badge"
import { LoginRateLimitBucketTable } from "./LoginRateLimitBucketTable"

interface Props {
  insights: AdminLoginRateLimitInsights
  displayTimeZone: string
}

// Insights-Panel priorisiert Verlaufstransparenz ("noisy"), nicht nur den
// aktuellen Sperrzustand.
export function LoginRateLimitInsights({ insights, displayTimeZone }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Gesamt: {formatInteger(insights.totalBucketCount)}</Badge>
        <Badge variant="outline">
          Aktiv geblockt: {formatInteger(insights.activeBlockedCount)}
        </Badge>
        <Badge variant="outline">Top noisy: letzte 24h / max. 10</Badge>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Top noisy (letzte 24 Stunden)</h3>
        <LoginRateLimitBucketTable
          buckets={insights.topNoisyBuckets}
          displayTimeZone={displayTimeZone}
          emptyText="Keine Rate-Limit-Daten in den letzten 24 Stunden."
        />
      </div>
    </div>
  )
}
