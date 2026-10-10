import { LOGIN_RATE_LIMIT_CONFIG } from "@vereinsheim/lib/auth/rate-limit/config"
import { createLoginRateLimitService } from "@vereinsheim/lib/auth/rate-limit/limiter"
import { createStoreForEnv } from "@vereinsheim/lib/auth/rate-limit/stores"

import { db } from "@/lib/db"

// Singleton: Store und Service einmal pro Prozess erstellen (bei Hot-Reload bleibt der Modul-Cache erhalten).
// In Tests im Speicher, sonst in der Datenbank; Store und Dienst liegen in `@vereinsheim/lib`.
const store = createStoreForEnv(db.loginRateLimitBucket, process.env.NODE_ENV)
const service = createLoginRateLimitService(store, LOGIN_RATE_LIMIT_CONFIG)

export const {
  checkLoginAllowed,
  registerFailedLoginAttempt,
  clearSuccessfulLoginAttempts,
  resetForTests,
  getBucketCountForTests,
} = service
