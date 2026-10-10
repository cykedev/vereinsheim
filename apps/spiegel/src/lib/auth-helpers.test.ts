import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../test/fixtures"

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect ${path}`)
  }),
}))
vi.mock("next-auth", async (original) => ({
  ...(await original<typeof import("next-auth")>()),
  getServerSession: mocks.getServerSession,
}))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))

const { getAuthSession, requireAdmin, requireSession } = await import("./auth-helpers")

const db = createPrismaClient()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "auth")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})
beforeEach(async () => {
  await db.user.update({
    where: { id: site.ownerId },
    data: { isActive: true, sessionVersion: 0, name: "Aus der Datenbank", role: "USER" },
  })
})

const sessionOf = (id: string, sessionVersion: number, role = "ADMIN") => ({
  user: { id, sessionVersion, role, name: "Aus dem Token", email: "x@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
})

describe("getAuthSession", () => {
  it("gültig: Name und Rolle aus der Datenbank, nicht aus dem Token", async () => {
    mocks.getServerSession.mockResolvedValue(sessionOf(site.ownerId, 0))
    const session = await getAuthSession()
    const { email } = await db.user.findUniqueOrThrow({ where: { id: site.ownerId } })
    expect(session?.user).toMatchObject({
      id: site.ownerId,
      name: "Aus der Datenbank",
      role: "USER",
      email,
    })
  })

  it("requireAdmin: ein Schütze mit Admin im Token geht zum Start (die Rolle kommt aus der Datenbank)", async () => {
    mocks.getServerSession.mockResolvedValue(sessionOf(site.ownerId, 0, "ADMIN"))
    await expect(requireAdmin()).rejects.toThrow("redirect /")
    await db.user.update({ where: { id: site.ownerId }, data: { role: "ADMIN" } })
    expect((await requireAdmin()).user.role).toBe("ADMIN")
  })

  it("deaktiviertes Konto, andere sessionVersion, unbekanntes Konto oder keine Sitzung: null", async () => {
    mocks.getServerSession.mockResolvedValue(sessionOf(site.ownerId, 0))
    await db.user.update({ where: { id: site.ownerId }, data: { isActive: false } })
    expect(await getAuthSession()).toBeNull()

    await db.user.update({
      where: { id: site.ownerId },
      data: { isActive: true, sessionVersion: 1 },
    })
    expect(await getAuthSession()).toBeNull()

    mocks.getServerSession.mockResolvedValue(sessionOf("gibt-es-nicht", 0))
    expect(await getAuthSession()).toBeNull()

    mocks.getServerSession.mockResolvedValue(null)
    expect(await getAuthSession()).toBeNull()
  })

  it("mit einem Passwort vom Admin geht jede Seite erst zur Passwortseite, nur sie selbst nicht", async () => {
    mocks.getServerSession.mockResolvedValue(sessionOf(site.ownerId, 0))
    await db.user.update({ where: { id: site.ownerId }, data: { mustChangePassword: true } })
    try {
      await expect(requireSession()).rejects.toThrow("redirect /profile/password")
      await expect(requireAdmin()).rejects.toThrow("redirect /profile/password")
      expect((await requireSession({ passwordChange: true })).user.mustChangePassword).toBe(true)
    } finally {
      await db.user.update({ where: { id: site.ownerId }, data: { mustChangePassword: false } })
    }
  })

  it("requireSession leitet ohne gültige Sitzung zur Anmeldung", async () => {
    mocks.getServerSession.mockResolvedValue(null)
    await expect(requireSession()).rejects.toThrow("redirect /login")
    mocks.getServerSession.mockResolvedValue(sessionOf(site.ownerId, 0))
    expect((await requireSession()).user.id).toBe(site.ownerId)
  })
})
