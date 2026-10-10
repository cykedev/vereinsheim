import { describe, expect, it } from "vitest"

import {
  authorizeCredentials,
  TIMING_HASH,
  type AuthorizeDeps,
  type CredentialUser,
} from "./credentials"

const user: CredentialUser = {
  id: "u1",
  name: "Schütze",
  email: "schuetze@example.com",
  role: "USER",
  sessionVersion: 3,
  isActive: true,
  passwordHash: "hash-von-richtig",
}

/** Abhängigkeiten als Aufzeichnung: welche Aufrufe in welcher Folge */
function deps(options: { allowed?: boolean; found?: CredentialUser | null; trust?: boolean } = {}) {
  const calls: string[] = []
  const value: AuthorizeDeps = {
    rateLimit: {
      async checkLoginAllowed(email, ip) {
        calls.push(`check ${email} ${ip}`)
        return { allowed: options.allowed ?? true, normalizedEmail: email, normalizedIp: ip }
      },
      async registerFailedLoginAttempt(email) {
        calls.push(`failed ${email}`)
      },
      async clearSuccessfulLoginAttempts(email) {
        calls.push(`clear ${email}`)
      },
    },
    async findUserByEmail(email) {
      calls.push(`find ${email}`)
      return options.found === undefined ? user : options.found
    },
    async comparePassword(password, hash) {
      calls.push(`compare ${hash}`)
      return password === "richtig" && hash === "hash-von-richtig"
    },
    trustProxyHeaders: options.trust ?? false,
  }
  return { value, calls }
}

describe("authorizeCredentials", () => {
  it("richtig: das Konto fürs JWT, Zähler geleert; E-Mail normalisiert", async () => {
    const { value, calls } = deps()
    expect(
      await authorizeCredentials({ email: " Schuetze@Example.com", password: "richtig" }, {}, value)
    ).toEqual({
      id: "u1",
      name: "Schütze",
      email: "schuetze@example.com",
      role: "USER",
      sessionVersion: 3,
    })
    expect(calls).toEqual([
      "check schuetze@example.com null",
      "find schuetze@example.com",
      "compare hash-von-richtig",
      "clear schuetze@example.com",
    ])
  })

  it("unbekannt oder deaktiviert: Vergleich gegen den festen Hash (gleich lange), Fehlversuch gezählt", async () => {
    for (const found of [null, { ...user, isActive: false }]) {
      const { value, calls } = deps({ found })
      expect(
        await authorizeCredentials({ email: user.email, password: "richtig" }, {}, value)
      ).toBeNull()
      expect(calls).toContain(`compare ${TIMING_HASH}`)
      expect(calls.at(-1)).toBe(`failed ${user.email}`)
    }
  })

  it("falsches Passwort: Fehlversuch gezählt", async () => {
    const { value, calls } = deps()
    expect(
      await authorizeCredentials({ email: user.email, password: "falsch" }, {}, value)
    ).toBeNull()
    expect(calls.at(-1)).toBe(`failed ${user.email}`)
  })

  it("gesperrt: kein Konto gesucht, kein Vergleich", async () => {
    const { value, calls } = deps({ allowed: false })
    expect(
      await authorizeCredentials({ email: user.email, password: "richtig" }, {}, value)
    ).toBeNull()
    expect(calls).toEqual([`check ${user.email} null`])
  })

  it("ohne E-Mail oder Passwort nichts; die IP nur mit Vertrauen in den Proxy", async () => {
    const { value, calls } = deps({ trust: true })
    expect(await authorizeCredentials(undefined, {}, value)).toBeNull()
    expect(await authorizeCredentials({ email: user.email }, {}, value)).toBeNull()
    expect(calls).toEqual([])
    await authorizeCredentials(
      { email: user.email, password: "richtig" },
      { "x-real-ip": "203.0.113.7" },
      value
    )
    expect(calls[0]).toBe(`check ${user.email} 203.0.113.7`)
  })
})
