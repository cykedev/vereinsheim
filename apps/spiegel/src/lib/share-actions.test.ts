import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"
import { sharedCard } from "./db/reads"
import { isShareId } from "./share"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
  revalidated: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => void mocks.revalidated++ }))

const { shareCard, stopSharingCard } = await import("./share-actions")

const MISSING = { error: "Diese Scheibe gibt es nicht mehr." }
const RETRY = { error: "Das geht gerade nicht. Lade die Seite neu." }
let site: TestSite
let otherId: string
let base = 8600
const asOwner = (id = site.ownerId, mustChangePassword = false) => {
  mocks.session = { user: { id, role: "USER", mustChangePassword } }
}

/** eine Scheibe schreiben, sichtbar oder wartend, eigene oder fremde */
async function card({ ownerId = site.ownerId, pending = false } = {}): Promise<string> {
  const [input] = generateSeason({
    seed: base,
    cards: 1,
    firstMs: Date.UTC(2026, 5, 2, 17) + base * 60_000,
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId,
    scheibenIdBase: base,
  })
  base += 1
  return (await writeRevision(db, { ...input, card: { ...input.card, ownerPending: pending } }))
    .cardId
}
const shareOf = (id: string) =>
  db.card.findUniqueOrThrow({ where: { id }, select: { shareId: true, sharedAt: true } })

beforeAll(async () => {
  site = await createTestSite(db, "share-actions")
  otherId = (
    await db.user.create({
      data: { email: `share-other-${randomUUID()}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

describe("shareCard", () => {
  it("teilt eine eigene sichtbare Scheibe; ein zweites Mal bleibt der Link", async () => {
    asOwner()
    const id = await card()
    const before = mocks.revalidated
    const first = await shareCard(id)
    if (!("success" in first) || !first.data) throw new Error(JSON.stringify(first))
    expect(isShareId(first.data.shareId)).toBe(true)
    expect(Math.abs(first.data.sharedAtMs - Date.now())).toBeLessThan(60_000)
    expect(await shareOf(id)).toEqual({
      shareId: first.data.shareId,
      sharedAt: new Date(first.data.sharedAtMs),
    })
    expect((await sharedCard(db, first.data.shareId))?.id).toBe(id)
    expect(await shareCard(id)).toEqual(first)
    // kein `revalidatePath`: Danach scrollte Next zum Anker der Adresse
    expect(mocks.revalidated).toBe(before)
  })

  it("fremde, wartende, gelöschte und unbekannte Scheiben nicht", async () => {
    asOwner()
    const foreign = await card({ ownerId: otherId })
    const pending = await card({ pending: true })
    const deleted = await card()
    await db.card.update({ where: { id: deleted }, data: { deletedAt: new Date() } })
    for (const id of [foreign, pending, deleted, "c0000000000000000000unknown", "../x"])
      expect(await shareCard(id)).toEqual(MISSING)
    for (const id of [foreign, pending, deleted])
      expect(await shareOf(id)).toEqual({ shareId: null, sharedAt: null })
  })

  it("ohne Sitzung und mit einem Passwort vom Admin nichts", async () => {
    const id = await card()
    mocks.session = null
    expect(await shareCard(id)).toEqual(RETRY)
    asOwner(site.ownerId, true)
    expect(await shareCard(id)).toEqual(RETRY)
    expect(await shareOf(id)).toEqual({ shareId: null, sharedAt: null })
  })
})

describe("stopSharingCard", () => {
  it("beendet das Teilen; neu teilen gibt einen neuen Link, der alte bleibt aus", async () => {
    asOwner()
    const id = await card()
    const first = await shareCard(id)
    if (!("success" in first) || !first.data) throw new Error(JSON.stringify(first))
    expect(await stopSharingCard(id)).toEqual({ success: true })
    expect(await shareOf(id)).toEqual({ shareId: null, sharedAt: null })
    expect(await sharedCard(db, first.data.shareId)).toBeNull()
    // schon beendet ist kein Fehler
    expect(await stopSharingCard(id)).toEqual({ success: true })

    const again = await shareCard(id)
    if (!("success" in again) || !again.data) throw new Error(JSON.stringify(again))
    expect(again.data.shareId).not.toBe(first.data.shareId)
    expect(await sharedCard(db, first.data.shareId)).toBeNull()
    expect((await sharedCard(db, again.data.shareId))?.id).toBe(id)
  })

  it("eine fremde nie; ohne Sitzung nichts", async () => {
    asOwner(otherId)
    const foreign = await card({ ownerId: otherId })
    const shared = await shareCard(foreign)
    if (!("success" in shared) || !shared.data) throw new Error(JSON.stringify(shared))
    asOwner()
    expect(await stopSharingCard(foreign)).toEqual(MISSING)
    expect(await stopSharingCard("../x")).toEqual(MISSING)
    mocks.session = null
    expect(await stopSharingCard(foreign)).toEqual(RETRY)
    expect((await shareOf(foreign)).shareId).toBe(shared.data.shareId)
  })
})
