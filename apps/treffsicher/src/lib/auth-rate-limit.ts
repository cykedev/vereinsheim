import { LOGIN_RATE_LIMIT_CONFIG } from "@vereinsheim/lib/auth/rate-limit/config"
import { createLoginRateLimitService } from "@vereinsheim/lib/auth/rate-limit/limiter"
import { createStoreForEnv } from "@vereinsheim/lib/auth/rate-limit/stores"
import type { LoginRateLimitCheck } from "@vereinsheim/lib/auth/rate-limit/types"
import { db } from "@/lib/db"

// In Tests im Speicher, sonst in der Datenbank; Store und Dienst liegen in `@vereinsheim/lib`.
const rateLimitStore = createStoreForEnv(db.loginRateLimitBucket, process.env.NODE_ENV)
const rateLimitService = createLoginRateLimitService(rateLimitStore, LOGIN_RATE_LIMIT_CONFIG)

export { LOGIN_RATE_LIMIT_CONFIG }

export async function checkLoginAllowed(
  email: string,
  ipHeaderValue?: string | null,
  nowMs: number = Date.now()
): Promise<LoginRateLimitCheck> {
  return rateLimitService.checkLoginAllowed(email, ipHeaderValue, nowMs)
}

export async function registerFailedLoginAttempt(
  normalizedEmail: string,
  normalizedIp: string | null,
  nowMs: number = Date.now()
): Promise<void> {
  return rateLimitService.registerFailedLoginAttempt(normalizedEmail, normalizedIp, nowMs)
}

export async function clearSuccessfulLoginAttempts(normalizedEmail: string): Promise<void> {
  return rateLimitService.clearSuccessfulLoginAttempts(normalizedEmail)
}

// Test-Helfer: nur in Unit-Tests verwenden.
export async function __resetLoginRateLimitForTests(): Promise<void> {
  return rateLimitService.resetForTests()
}

// Test-Helfer: nur in Unit-Tests verwenden.
export async function __getLoginRateLimitBucketCountForTests(): Promise<number> {
  return rateLimitService.getBucketCountForTests()
}
