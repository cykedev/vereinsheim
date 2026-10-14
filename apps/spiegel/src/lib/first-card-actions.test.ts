import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { sportpassHash } from "@vereinsheim/ingest-contract/sportpass"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { consentStatus } from "./consent/status"
import { writeRevision } from "./db/cards"
import { bridgeState } from "./ingest/bridges"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { confirmFirstCard, rejectFirstCard } = await import("./first-card-actions")

let site: TestSite
let otherId: string
let base = 7000
const SPORTPASS = BigInt(4711)
const asOwner = (id = site.ownerId) => {
  mocks.session = { user: { id, role: "USER" } }
}

/** Scheiben unter einer SportpassID schreiben, wartend oder nicht */
async function cards(
  count: number,
  {
    ownerId = site.ownerId,
    pending = true,
    sportpassId = SPORTPASS,
    sourceId = site.sourceId,
    disciplineId = site.disciplineId,
  } = {}
): Promise<string[]> {
  const inputs = generateSeason({
    seed: base,
    cards: count,
    firstMs: Date.UTC(2026, 5, 2, 17) + base * 60_000,
    everyDays: 1,
    sourceId,
    disciplineId,
    ownerId,
    scheibenIdBase: base,
  })
  base += 100
  const ids: string[] = []
  for (const input of inputs)
    ids.push(
      (
        await writeRevision(db, {
          ...input,
          card: { ...input.card, ownerPending: pending, sportpassId },
        })
      ).cardId
    )
  return ids
}

async function consent(data: { firstCardConfirmedAt?: Date; rejectedAt?: Date } = {}) {
  await db.sportpassConsent.deleteMany({ where: { siteId: site.siteId } })
  return db.sportpassConsent.create({
    data: {
      userId: site.ownerId,
      siteId: site.siteId,
      sportpassId: SPORTPASS,
      confirmedAt: data.rejectedAt ? null : new Date(),
      ...data,
    },
  })
}

beforeAll(async () => {
  site = await createTestSite(db, "first-card")
  otherId = (
    await db.user.create({
      data: { email: `andere-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.card.deleteMany({ where: { ownerId: otherId } })
  await db.user.delete({ where: { id: otherId } })
  await site.remove()
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = null
})

describe("Ja, meine", () => {
  it("macht alle Wartenden der SportpassID sichtbar und bestätigt die erste Scheibe", async () => {
    const row = await consent()
    const [first, second] = await cards(2)
    const [elsewhere] = await cards(1, { sportpassId: BigInt(999) })
    asOwner()
    expect(await confirmFirstCard(second)).toEqual({ success: true })
    const after = await db.card.findMany({ where: { id: { in: [first, second, elsewhere] } } })
    expect(after.find((c) => c.id === first)!.ownerPending).toBe(false)
    expect(after.find((c) => c.id === second)!.ownerPending).toBe(false)
    // eine andere SportpassID wartet weiter
    expect(after.find((c) => c.id === elsewhere)!.ownerPending).toBe(true)
    const confirmed = await db.sportpassConsent.findUniqueOrThrow({ where: { id: row.id } })
    expect(confirmed.firstCardConfirmedAt).not.toBeNull()
  })

  it("eine fremde oder nicht wartende Scheibe gibt es nicht; nichts geändert", async () => {
    await consent()
    const [foreign] = await cards(1, { ownerId: otherId })
    const [visible] = await cards(1, { pending: false })
    asOwner()
    expect(await confirmFirstCard(foreign)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect(await confirmFirstCard(visible)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect(await confirmFirstCard("keine")).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect((await db.card.findUniqueOrThrow({ where: { id: foreign } })).ownerPending).toBe(true)
  })

  it("ohne Anmeldung oder mit einem Passwort vom Admin nichts", async () => {
    await consent()
    const [card] = await cards(1)
    expect(await confirmFirstCard(card)).toEqual({
      error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an.",
    })
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect(await rejectFirstCard(card)).toEqual({
      error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an.",
    })
    expect((await db.card.findUniqueOrThrow({ where: { id: card } })).ownerPending).toBe(true)
  })
})

describe("Grenzen (Review)", () => {
  it("zweimal „Nicht meine“ zugleich wirft nicht: eines entfernt, das andere findet nichts mehr", async () => {
    await consent()
    const [card] = await cards(2)
    asOwner()
    const results = await Promise.all([rejectFirstCard(card), rejectFirstCard(card)])
    expect(results.filter((r) => "success" in r)).toHaveLength(1)
    expect(results.filter((r) => "error" in r)).toHaveLength(1)
  })

  it("eine Anlage bestätigt nur ihre Scheiben: dieselbe SportpassID an einer anderen bleibt wartend", async () => {
    await consent()
    const other = await createTestSite(db, "first-card-b")
    try {
      const [here] = await cards(1)
      const [there] = await cards(1, { sourceId: other.sourceId, disciplineId: other.disciplineId })
      asOwner()
      expect(await confirmFirstCard(here)).toEqual({ success: true })
      expect((await db.card.findUniqueOrThrow({ where: { id: there } })).ownerPending).toBe(true)
      expect(await rejectFirstCard(there)).toEqual({ success: true })
      expect(await db.card.count({ where: { id: here } })).toBe(1)
    } finally {
      await db.card.deleteMany({ where: { source: { siteId: other.siteId } } })
      await other.remove()
    }
  })
})

describe("Nicht meine", () => {
  it("entfernt alle Wartenden der SportpassID mit Grabstein; die Zustimmung geht zurück an den Admin", async () => {
    const row = await consent()
    const pending = await cards(2)
    const [kept] = await cards(1, { pending: false })
    asOwner()
    expect(await rejectFirstCard(pending[0])).toEqual({ success: true })
    expect(await db.card.count({ where: { id: { in: pending } } })).toBe(0)
    expect(
      await db.tombstone.count({ where: { sourceId: site.sourceId, reason: "nicht-meine" } })
    ).toBeGreaterThanOrEqual(2)
    // eine schon bestätigte Scheibe derselben Nummer bleibt
    expect(await db.card.count({ where: { id: kept } })).toBe(1)
    const returned = await db.sportpassConsent.findUniqueOrThrow({ where: { id: row.id } })
    expect(consentStatus(returned)).toBe("returned")
    expect(returned.firstCardConfirmedAt).toBeNull()
    const state = await bridgeState(db, site.siteId)
    expect(state.sportpass.hashes).not.toContain(sportpassHash(state.sportpass.salt, SPORTPASS))
  })

  it("eine abgelehnte Zustimmung bleibt abgelehnt", async () => {
    const row = await consent({ rejectedAt: new Date() })
    const [card] = await cards(1)
    asOwner()
    expect(await rejectFirstCard(card)).toEqual({ success: true })
    expect(
      consentStatus(await db.sportpassConsent.findUniqueOrThrow({ where: { id: row.id } }))
    ).toBe("rejected")
  })

  it("eine fremde Scheibe gibt es nicht; sie bleibt", async () => {
    await consent()
    const [foreign] = await cards(1, { ownerId: otherId })
    asOwner()
    expect(await rejectFirstCard(foreign)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect(await db.card.count({ where: { id: foreign } })).toBe(1)
  })
})
