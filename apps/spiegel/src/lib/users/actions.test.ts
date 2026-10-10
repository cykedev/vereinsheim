import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: string } } }))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { createUser, updateUser } = await import("./actions")

const tag = randomUUID().slice(0, 8)
const mail = (name: string) => `${name}-${tag}@example.com`
let adminId: string

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeAll(async () => {
  adminId = (
    await db.user.create({
      data: { email: mail("admin"), passwordHash: "-", role: "ADMIN" },
    })
  ).id
})
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: adminId, role: "ADMIN" } }
})

describe("createUser", () => {
  it("nur ein angemeldeter Admin", async () => {
    mocks.session = null
    expect(await createUser(null, form({}))).toEqual({ error: "Nicht angemeldet" })
    mocks.session = { user: { id: adminId, role: "USER" } }
    expect(await createUser(null, form({}))).toEqual({ error: "Keine Berechtigung" })
  })

  it("legt ein Konto an: E-Mail normalisiert, Passwort als Hash; doppelt geht nicht", async () => {
    const fields = {
      name: "Neu",
      email: `  ${mail("Neu").toUpperCase()} `,
      tempPassword: "vorlaeufig-1234",
      role: "USER",
    }
    expect(await createUser(null, form(fields))).toEqual({ success: true })
    const user = await db.user.findUniqueOrThrow({ where: { email: mail("neu") } })
    expect(user).toMatchObject({ name: "Neu", role: "USER", isActive: true })
    expect(await bcrypt.compare("vorlaeufig-1234", user.passwordHash)).toBe(true)
    expect(await createUser(null, form(fields))).toEqual({
      error: "Diese E-Mail-Adresse wird bereits verwendet.",
    })
  })

  it("Feldfehler bei zu kurzem Passwort", async () => {
    const result = await createUser(
      null,
      form({ name: "", email: mail("kurz"), tempPassword: "kurz", role: "USER" })
    )
    expect(result).toMatchObject({ error: { tempPassword: [expect.stringMatching(/12/)] } })
  })
})

describe("updateUser", () => {
  it("ein neues Passwort beendet die Sitzungen (sessionVersion steigt)", async () => {
    const user = await db.user.create({
      data: { email: mail("reset"), passwordHash: "-", role: "USER" },
    })
    const result = await updateUser(
      user.id,
      null,
      form({
        name: "",
        email: mail("reset"),
        role: "USER",
        isActive: "true",
        tempPassword: "neu-und-lang-12",
      })
    )
    expect(result).toEqual({ success: true })
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.sessionVersion).toBe(user.sessionVersion + 1)
    expect(await bcrypt.compare("neu-und-lang-12", after.passwordHash)).toBe(true)
  })

  it("eine neue Rolle oder ein neuer Status beendet die Sitzungen; nur der Name nicht", async () => {
    const user = await db.user.create({
      data: { email: mail("rolle"), passwordHash: "-", role: "ADMIN" },
    })
    const fields = { name: "", email: mail("rolle"), isActive: "true", tempPassword: "" }
    await updateUser(user.id, null, form({ ...fields, role: "USER" }))
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(1)
    await updateUser(user.id, null, form({ ...fields, role: "USER", isActive: "false" }))
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(2)
    await updateUser(
      user.id,
      null,
      form({ ...fields, name: "Nur Name", role: "USER", isActive: "false" })
    )
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(2)
  })

  it("das eigene Konto nicht deaktivieren; fremde E-Mail nicht übernehmen", async () => {
    expect(
      await updateUser(
        adminId,
        null,
        form({ name: "", email: mail("admin"), role: "ADMIN", isActive: "false", tempPassword: "" })
      )
    ).toEqual({ error: "Du kannst dein eigenes Konto nicht deaktivieren." })
    const other = await db.user.create({
      data: { email: mail("andere"), passwordHash: "-", role: "USER" },
    })
    expect(
      await updateUser(
        other.id,
        null,
        form({ name: "", email: mail("admin"), role: "USER", isActive: "true", tempPassword: "" })
      )
    ).toEqual({ error: "Diese E-Mail-Adresse wird bereits verwendet." })
  })
})
