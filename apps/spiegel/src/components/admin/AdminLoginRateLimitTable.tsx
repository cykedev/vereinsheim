"use client"

import { LoginRateLimitTable } from "@vereinsheim/ui/admin/LoginRateLimitTable"
import type { AdminLoginRateLimitBucket } from "@/lib/admin/types"
import { clearLoginRateLimitBucket } from "@/lib/admin/actions"

interface Props {
  buckets: AdminLoginRateLimitBucket[]
  displayTimeZone: string
}

// Dünner Wrapper: die Oberfläche ist geteilt, die Server Action bleibt app-lokal
// (geteilte Dateien dürfen keine Server-Action-Re-Exports sein).
export function AdminLoginRateLimitTable({ buckets, displayTimeZone }: Props) {
  return (
    <LoginRateLimitTable
      buckets={buckets}
      displayTimeZone={displayTimeZone}
      onClear={async (bucketKey) => {
        const result = await clearLoginRateLimitBucket(bucketKey)
        if ("error" in result && result.error) {
          return {
            error: typeof result.error === "string" ? result.error : "Fehler beim Entsperren.",
          }
        }
        return {}
      }}
    />
  )
}
