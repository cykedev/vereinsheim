import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({ session: null as null | { user: { id: string } } }))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))

const { changeOwnPassword } = await import("./password")

const email = `passwort-${randomUUID().slice(0, 8)}@example.com`
let userId: string

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("vom-admin-vergeben", 4),
      mustChangePassword: true,
    },
  })
  userId = user.id
  mocks.session = { user: { id: userId } }
})
afterAll(async () => {
  await db.user.deleteMany({ where: { email } })
  await db.$disconnect()
})

const form = (current: string, next: string, confirm = next) => {
  const data = new FormData()
  data.set("currentPassword", current)
  data.set("newPassword", next)
  data.set("confirmPassword", confirm)
  return data
}

describe("changeOwnPassword", () => {
  it("falsches aktuelles Passwort oder ungleiche Wiederholung: nichts geändert", async () => {
    expect(await changeOwnPassword(null, form("falsch-falsch-1", "mein-eigenes-pw-1"))).toEqual({
      error: "Das aktuelle Passwort stimmt nicht.",
    })
    expect(
      await changeOwnPassword(
        null,
        form("vom-admin-vergeben", "mein-eigenes-pw-1", "anders-anders-1")
      )
    ).toMatchObject({ error: expect.stringMatching(/stimmen nicht/) })
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user).toMatchObject({ mustChangePassword: true, sessionVersion: 0 })
  })

  it("ersetzt das Passwort vom Admin, beendet die Sitzungen", async () => {
    expect(await changeOwnPassword(null, form("vom-admin-vergeben", "mein-eigenes-pw-1"))).toEqual({
      success: true,
    })
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user).toMatchObject({ mustChangePassword: false, sessionVersion: 1 })
    expect(await bcrypt.compare("mein-eigenes-pw-1", user.passwordHash)).toBe(true)
  })

  it("ohne Sitzung nichts", async () => {
    mocks.session = null
    expect(await changeOwnPassword(null, form("a", "b"))).toEqual({
      error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an.",
    })
  })
})
