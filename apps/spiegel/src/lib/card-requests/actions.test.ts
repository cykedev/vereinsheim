import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { removeCardRequest, requestCardAction, withdrawCardRequest } = await import("./actions")

// Die Actions legen an der ersten Anlage an (eine je Installation); der Test räumt die Aufträge seines Kontos weg.
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

describe("requestCardAction", () => {
  it("ohne Sitzung oder mit Passwort vom Admin nichts", async () => {
    mocks.session = null
    expect(await requestCardAction("ff914420", "2026-10-21")).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = { user: { id: user, role: "USER", mustChangePassword: true } }
    expect(await requestCardAction("ff914420", "2026-10-21")).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })

  it("prüft ID und Tag als Feldfehler", async () => {
    mocks.session = { user: { id: user, role: "USER" } }
    const result = await requestCardAction("ff91442", "2999-01-01")
    expect(result).toEqual({
      error: {
        id: ["Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck."],
        day: ["Bitte den Tag der Scheibe wählen, nicht nach heute."],
      },
    })
    for (const day of ["2026-02-30", "21.10.2026", "", 7 as unknown as string])
      expect(await requestCardAction("ff914420", day)).toMatchObject({
        error: { day: expect.any(Array) },
      })
  })

  it("legt an, nicht zweimal, und zieht zurück", async () => {
    if (!hasSite) return
    mocks.session = { user: { id: user, role: "USER" } }
    expect(await requestCardAction("ID: 7fff0001", "2026-10-21")).toEqual({
      success: true,
      data: { kind: "created" },
    })
    expect(await requestCardAction("7FFF0001", "2026-10-21")).toEqual({
      error: "Diese Scheibe ist schon angefragt.",
    })
    const row = await db.cardRequest.findFirstOrThrow({ where: { userId: user } })
    expect(row).toMatchObject({ scheibenId: 0x7fff0001, day: "2026-10-21", status: "open" })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await withdrawCardRequest(row.id)).toEqual({
      error: "Dieser Auftrag wartet nicht mehr. Lade die Seite neu.",
    })
    mocks.session = { user: { id: user, role: "USER" } }
    expect(await withdrawCardRequest(row.id)).toEqual({ success: true })
    expect(await withdrawCardRequest(row.id)).toEqual({
      error: "Dieser Auftrag wartet nicht mehr. Lade die Seite neu.",
    })
    expect(await withdrawCardRequest(-1)).toEqual({
      error: "Dieser Auftrag wartet nicht mehr. Lade die Seite neu.",
    })
  })
})

describe("removeCardRequest", () => {
  const refused = { error: "Dieser Auftrag lässt sich nicht entfernen. Lade die Seite neu." }

  it("ohne Sitzung nichts", async () => {
    mocks.session = null
    expect(await removeCardRequest(1)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })

  it("entfernt nur eigene, beendete Aufträge ohne Scheibe, einmal", async () => {
    if (!hasSite) return
    mocks.session = { user: { id: user, role: "USER" } }
    expect(await requestCardAction("7fff0002", "2026-10-21")).toMatchObject({ success: true })
    const row = await db.cardRequest.findFirstOrThrow({
      where: { userId: user, scheibenId: 0x7fff0002 },
    })
    // wartet noch: zurückziehen, nicht entfernen
    expect(await removeCardRequest(row.id)).toEqual(refused)
    expect(await withdrawCardRequest(row.id)).toEqual({ success: true })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await removeCardRequest(row.id)).toEqual(refused)
    mocks.session = { user: { id: user, role: "USER" } }
    expect(await removeCardRequest(-1)).toEqual(refused)
    expect(await removeCardRequest(row.id)).toEqual({ success: true })
    expect(await removeCardRequest(row.id)).toEqual(refused)
    expect(await db.cardRequest.count({ where: { id: row.id } })).toBe(0)
  })
})
