import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"

import { LOGIN_RATE_LIMIT_CONFIG } from "@vereinsheim/lib/auth/rate-limit/config"
import { createLoginRateLimitService } from "@vereinsheim/lib/auth/rate-limit/limiter"
import { createDbStore } from "@vereinsheim/lib/auth/rate-limit/stores"

import { db } from "@/lib/db"

// Gegen die Dev-Datenbank, mit eigenen Schlüsseln: Die Anmeldung läuft in Produktion über diesen Store, die Tests der
// übrigen App über den im Speicher. Nie `resetForTests` hier, das leerte die ganze Tabelle.
const tag = randomUUID().slice(0, 8)
const email = `test-${tag}@example.com`
const keys = [`email:${email}`]

afterAll(async () => {
  await db.loginRateLimitBucket.deleteMany({ where: { key: { in: keys } } })
  await db.$disconnect()
})

describe("Ratenbegrenzung über die Datenbank", () => {
  it("sperrt eine E-Mail nach fünf Fehlversuchen und gibt sie nach der Sperrzeit frei", async () => {
    // der Store aus der Bibliothek gegen die echte Tabelle: passt der Prisma-Delegate auf die Schnittstelle?
    const service = createLoginRateLimitService(
      createDbStore(db.loginRateLimitBucket),
      LOGIN_RATE_LIMIT_CONFIG
    )
    const nowMs = Date.now()
    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxAttemptsPerEmail; i++) {
      const state = await service.checkLoginAllowed(email, null, nowMs + i)
      expect(state.allowed).toBe(true)
      await service.registerFailedLoginAttempt(state.normalizedEmail, state.normalizedIp, nowMs + i)
    }
    expect((await service.checkLoginAllowed(email, null, nowMs + 100)).allowed).toBe(false)
    const row = await db.loginRateLimitBucket.findUniqueOrThrow({ where: { key: keys[0] } })
    expect(row.blockedUntil).not.toBeNull()

    const later = nowMs + LOGIN_RATE_LIMIT_CONFIG.blockMs + 1_000
    expect((await service.checkLoginAllowed(email, null, later)).allowed).toBe(true)
    await service.clearSuccessfulLoginAttempts(`${email}`)
  })
})
