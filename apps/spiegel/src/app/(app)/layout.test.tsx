import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

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

const { default: AppLayout } = await import("./layout")

const db = createPrismaClient()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "layout")
  await db.user.update({ where: { id: site.ownerId }, data: { mustChangePassword: true } })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

describe("Layout der App", () => {
  it("leitet bei einem Passwort vom Admin nicht selbst um: sonst kreiste die Passwortseite (307 auf sich)", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: site.ownerId, sessionVersion: 0, role: "USER" },
      expires: "2099-01-01T00:00:00.000Z",
    })
    await expect(AppLayout({ children: null })).resolves.toBeTruthy()
  })

  it("ohne Sitzung zur Anmeldung", async () => {
    mocks.getServerSession.mockResolvedValue(null)
    await expect(AppLayout({ children: null })).rejects.toThrow("redirect /login")
  })
})
