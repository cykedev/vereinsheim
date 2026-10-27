import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { removeCardRequest } = await import("./actions")

// Aufträge an der ersten Anlage (eine je Installation); der Test räumt die Aufträge seines Kontos weg.
let user: string
let hasSite = false

beforeAll(async () => {
  user = (
    await db.user.create({
      data: { email: `req-action-${Date.now()}@example.com`, name: "A", passwordHash: "-" },
    })
  ).id
  hasSite = (await db.site.count()) > 0
})
afterAll(async () => {
  await db.cardRequest.deleteMany({ where: { userId: user } })
  await db.user.delete({ where: { id: user } })
  await db.$disconnect()
})

describe("removeCardRequest", () => {
  const refused = { error: "Dieser Auftrag lässt sich nicht entfernen. Lade die Seite neu." }

  it("ohne Sitzung nichts", async () => {
    mocks.session = null
    expect(await removeCardRequest(1)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })

  it("zieht nur eigene, ungefüllte Aufträge zurück, einmal; die Zeile bleibt", async () => {
    const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
    if (!hasSite || !site) return
    const row = await db.cardRequest.create({
      data: { userId: user, siteId: site.id, scheibenId: 0x7fff0002, day: "2026-10-21" },
    })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await removeCardRequest(row.id)).toEqual(refused)
    mocks.session = { user: { id: user, role: "USER" } }
    expect(await removeCardRequest(-1)).toEqual(refused)
    expect(await removeCardRequest(row.id)).toEqual({ success: true })
    expect(await removeCardRequest(row.id)).toEqual(refused)
    expect((await db.cardRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      "withdrawn"
    )
  })
})
