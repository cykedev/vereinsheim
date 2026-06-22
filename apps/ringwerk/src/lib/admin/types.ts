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
