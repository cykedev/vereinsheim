import { createRateLimitStoreForCurrentEnv } from "@/lib/auth-rate-limit/store"
import { createLoginRateLimitService } from "@/lib/auth-rate-limit/limiter"
import { LOGIN_RATE_LIMIT_CONFIG } from "@/lib/auth-rate-limit/config"

// Singleton: Store und Service einmal pro Prozess erstellen.
// Bei Hot-Reload bleibt der Modul-Cache erhalten — kein Verbindungsleck.
const store = createRateLimitStoreForCurrentEnv()
const service = createLoginRateLimitService(store, LOGIN_RATE_LIMIT_CONFIG)

export const {
  checkLoginAllowed,
  registerFailedLoginAttempt,
  clearSuccessfulLoginAttempts,
  resetForTests,
  getBucketCountForTests,
} = service
