import bcrypt from "bcryptjs"
import { describe, expect, it } from "vitest"

import { ensureSeedAdmin } from "./startup"

interface FakeUser {
  id: string
  role: string
  isActive: boolean
  email: string
  passwordHash: string
}

/** eine Tabelle `User` im Speicher: genug für die Abfragen von `ensureSeedAdmin` */
function fakeDb(users: FakeUser[]) {
  return {
    user: {
      findFirst: async ({ where }: { where: { role: string; isActive: boolean } }) =>
        users.find((u) => u.role === where.role && u.isActive === where.isActive) ?? null,
      findUnique: async ({ where }: { where: { email: string } }) =>
        users.find((u) => u.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const user = users.find((u) => u.id === where.id)!
        Object.assign(user, { role: data.role, isActive: data.isActive })
        return user
      },
      create: async ({ data }: { data: { email: string; passwordHash: string; role: string } }) => {
        const user = { id: `u${users.length + 1}`, isActive: true, ...data }
        users.push(user)
        return user
      },
    },
  } as unknown as Parameters<typeof ensureSeedAdmin>[0]
}

describe("ensureSeedAdmin", () => {
  it("ohne E-Mail oder Passwort: nichts", async () => {
    const users: FakeUser[] = []
    expect(await ensureSeedAdmin(fakeDb(users), { email: "a@b.de" })).toBe("missing-env")
    expect(await ensureSeedAdmin(fakeDb(users), { password: "x".repeat(12) })).toBe("missing-env")
    expect(users).toHaveLength(0)
  })

  it("legt den ersten Admin an, mit normalisierter E-Mail und bcrypt-Hash; mit aktivem Admin nie wieder", async () => {
    const users: FakeUser[] = []
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

  it("nur ein inaktiver Admin zählt nicht; das Startkonto wird wieder aktiver Admin, nicht doppelt angelegt", async () => {
    const users: FakeUser[] = [
      { id: "u1", role: "ADMIN", isActive: false, email: "alt@example.com", passwordHash: "-" },
      { id: "u2", role: "USER", isActive: true, email: "start@example.com", passwordHash: "-" },
    ]
    expect(
      await ensureSeedAdmin(fakeDb(users), {
        email: "start@example.com",
        password: "geheim-genug-12",
      })
    ).toBe("restored")
    expect(users).toHaveLength(2)
    expect(users[1]).toMatchObject({ role: "ADMIN", isActive: true })
  })
})
