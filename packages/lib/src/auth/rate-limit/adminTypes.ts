// Ansichtstypen der Login-Rate-Limit-Verwaltung. Beide Apps zeigen dieselben
// Buckets in derselben Oberfläche (@vereinsheim/ui/admin/*); die Typen liegen
// deshalb neben dem Rate-Limit-Kern und nicht in den Apps.
//
// Die Werte selbst liest jede App aus ihrer eigenen DB (`lib/admin/actions`).

export type AdminLoginRateLimitBucket = {
  key: string
  type: "EMAIL" | "IP"
  identifier: string
  attempts: number
  windowStartedAt: Date
  blockedUntil: Date | null
  lastAttemptAt: Date
}

export type AdminLoginRateLimitInsights = {
  totalBucketCount: number
  activeBlockedCount: number
  activeBlockedBuckets: AdminLoginRateLimitBucket[]
  topNoisyBuckets: AdminLoginRateLimitBucket[]
}
