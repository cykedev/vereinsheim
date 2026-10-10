import { LOGIN_RATE_LIMIT_CONFIG } from "@vereinsheim/lib/auth/rate-limit/config"
import { createLoginRateLimitService } from "@vereinsheim/lib/auth/rate-limit/limiter"
import { createStoreForEnv } from "@vereinsheim/lib/auth/rate-limit/stores"

import { db } from "@/lib/db"

// Einmal je Prozess (bei Hot-Reload bleibt der Modul-Cache): in Tests im Speicher, sonst in der Datenbank. Store und
// Dienst liegen in `@vereinsheim/lib`, die Tabelle kommt von hier.
const store = createStoreForEnv(db.loginRateLimitBucket, process.env.NODE_ENV)
const service = createLoginRateLimitService(store, LOGIN_RATE_LIMIT_CONFIG)

export const {
  checkLoginAllowed,
  registerFailedLoginAttempt,
  clearSuccessfulLoginAttempts,
  resetForTests,
  getBucketCountForTests,
} = service
