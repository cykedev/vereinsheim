import bcrypt from "bcryptjs"
import { describe, expect, it } from "vitest"

import { ensureSeedAdmin } from "./startup"

/** eine Tabelle `User` im Speicher: genug für die zwei Abfragen von `ensureSeedAdmin` */
function fakeDb(users: { id: string; role: string; email: string; passwordHash: string }[]) {
  return {
    user: {
      findFirst: async ({ where }: { where: { role: string } }) =>
        users.find((u) => u.role === where.role) ?? null,
      create: async ({ data }: { data: { email: string; passwordHash: string; role: string } }) => {
        const user = { id: `u${users.length + 1}`, ...data }
        users.push(user)
        return user
      },
    },
  } as unknown as Parameters<typeof ensureSeedAdmin>[0]
}

describe("ensureSeedAdmin", () => {
  it("ohne E-Mail oder Passwort: nichts", async () => {
    const users: never[] = []
    expect(await ensureSeedAdmin(fakeDb(users), { email: "a@b.de" })).toBe("missing-env")
    expect(await ensureSeedAdmin(fakeDb(users), { password: "x".repeat(12) })).toBe("missing-env")
    expect(users).toHaveLength(0)
  })

  it("legt den ersten Admin an, mit normalisierter E-Mail und bcrypt-Hash; danach nie wieder", async () => {
    const users: { id: string; role: string; email: string; passwordHash: string }[] = []
    const env = { email: "  Schuetze@Example.COM ", password: "geheim-genug-12" }
    expect(await ensureSeedAdmin(fakeDb(users), env)).toBe("created")
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({ email: "schuetze@example.com", role: "ADMIN" })
    expect(await bcrypt.compare(env.password, users[0].passwordHash)).toBe(true)
    expect(await ensureSeedAdmin(fakeDb(users), { ...env, email: "anders@example.com" })).toBe(
      "exists"
    )
    expect(users).toHaveLength(1)
  })
})
