import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { createTestSite, type TestSite } from "../../test/fixtures"

import { writeEnteredCard } from "./db/entered"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))

const { setCardPlace } = await import("./card-place-actions")

let site: TestSite
const tag = randomUUID().slice(0, 8)

beforeAll(async () => {
  site = await createTestSite(db, "card-place")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: site.ownerId, role: "USER" } }
})

const card = async (origin: "pdf" | "manual") => {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin,
    disciplineId: site.disciplineId,
    startedAtMs: Date.UTC(2026, 9, 20, 17),
    kind: "training",
    details: origin === "manual" ? { total: { rings: 380, shots: 40 } } : {},
    reason: `Test ${tag}`,
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}
const placeOf = async (id: string) =>
  (await db.card.findUniqueOrThrow({ where: { id }, select: { place: true } })).place

describe("setCardPlace", () => {
  it("Ort einer Scheibe vom Ausdruck: getrimmt, leer heißt keiner", async () => {
    const id = await card("pdf")
    expect(await setCardPlace(id, "  Halle   Süd ")).toEqual({ success: true })
    expect(await placeOf(id)).toBe("Halle Süd")
    expect(await setCardPlace(id, "")).toEqual({ success: true })
    expect(await placeOf(id)).toBeNull()
  })

  it("zu lang, fremd, gelöscht oder ohne Anmeldung: nichts geändert", async () => {
    const id = await card("manual")
    expect(await setCardPlace(id, "x".repeat(81))).toEqual({
      error: { place: ["Der Ort hat höchstens 80 Zeichen."] },
    })
    mocks.session = { user: { id: "someone-else", role: "USER" } }
    expect(await setCardPlace(id, "Halle")).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    await db.card.update({ where: { id }, data: { deletedAt: new Date() } })
    expect(await setCardPlace(id, "Halle")).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    mocks.session = null
    expect(await setCardPlace(id, "Halle")).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    expect(await placeOf(id)).toBeNull()
  })
})
