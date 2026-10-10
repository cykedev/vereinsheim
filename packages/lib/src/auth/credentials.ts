// Der Ablauf einer Anmeldung mit E-Mail und Passwort (NextAuth `authorize`), gemeinsam für Ringwerk, Treffsicher und
// Spiegel (vorher je App kopiert): Ratenbegrenzung prüfen, Konto suchen, Passwort vergleichen, Fehlversuch zählen
// oder Zähler leeren. Datenbank, Ratenbegrenzung und bcrypt kommen von der App.

import { extractClientIp } from "./client-ip"
import type { LoginRateLimitCheck } from "./rate-limit/types"
import { normalizeLoginEmail } from "./validation"

/**
 * bcrypt-Hash (Kosten 12) eines zufälligen Werts, den niemand kennt: Vergleichsziel ohne Konto. So kostet eine
 * unbekannte oder deaktivierte E-Mail so viel Zeit wie eine bekannte, die Antwortzeit verrät keine Konten.
 */
export const TIMING_HASH = "$2b$12$8gH/lIbar6PMu5jjPCh9BO6ru13ubQrRmkqp1/Y8H7Zlqf4u6vwbi"

export interface CredentialUser {
  id: string
  name: string | null
  email: string
  role: string
  sessionVersion: number
  isActive: boolean
  passwordHash: string
}

/** was ins JWT kommt */
export interface AuthorizedUser {
  id: string
  name: string | null
  email: string
  role: string
  sessionVersion: number
}

export interface AuthorizeDeps {
  rateLimit: {
    checkLoginAllowed(email: string, ipHeaderValue: string | null): Promise<LoginRateLimitCheck>
    registerFailedLoginAttempt(normalizedEmail: string, normalizedIp: string | null): Promise<void>
    clearSuccessfulLoginAttempts(normalizedEmail: string): Promise<void>
  }
  findUserByEmail(email: string): Promise<CredentialUser | null>
  /** `bcrypt.compare` */
  comparePassword(password: string, hash: string): Promise<boolean>
  /** `AUTH_TRUST_PROXY_HEADERS === "true"` */
  trustProxyHeaders: boolean
}

/**
 * Das Konto zu E-Mail und Passwort oder null. Jeder Fehler sieht gleich aus (gesperrt, unbekannt, deaktiviert,
 * falsches Passwort) und dauert gleich lang: Das erschwert das Ausforschen von Konten.
 */
export async function authorizeCredentials(
  credentials: { email?: string; password?: string } | undefined,
  headers: Record<string, unknown> | undefined,
  deps: AuthorizeDeps
): Promise<AuthorizedUser | null> {
  if (!credentials?.email || !credentials.password) return null
  const email = normalizeLoginEmail(credentials.email)
  if (!email) return null

  const state = await deps.rateLimit.checkLoginAllowed(
    email,
    extractClientIp(headers, deps.trustProxyHeaders)
  )
  if (!state.allowed) return null

  const user = await deps.findUserByEmail(email)
  const valid = await deps.comparePassword(
    credentials.password,
    user?.isActive ? user.passwordHash : TIMING_HASH
  )
  if (!user || !user.isActive || !valid) {
    await deps.rateLimit.registerFailedLoginAttempt(state.normalizedEmail, state.normalizedIp)
    return null
  }

  await deps.rateLimit.clearSuccessfulLoginAttempts(state.normalizedEmail)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  }
}
