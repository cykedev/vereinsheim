import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"
import { ownerCards, trashCards } from "./db/reads"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { deleteCard, purgeCardNow, restoreCard } = await import("./trash-actions")

const DAY_MS = 86_400_000
let site: TestSite
let otherId: string
let base = 8100
const asOwner = (id = site.ownerId) => {
  mocks.session = { user: { id, role: "USER" } }
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
const stateOf = (id: string) => db.card.findUnique({ where: { id }, select: { deletedAt: true } })

beforeAll(async () => {
  site = await createTestSite(db, "trash-actions")
  otherId = (
    await db.user.create({
      data: { email: `trash-other-${randomUUID()}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

describe("deleteCard", () => {
  it("legt eine eigene sichtbare Scheibe in den Papierkorb; ein zweites Mal sagt es", async () => {
    asOwner()
    const id = await card()
    expect(await deleteCard(id)).toEqual({ success: true })
    expect((await stateOf(id))?.deletedAt).toBeInstanceOf(Date)
    expect(await deleteCard(id)).toEqual({ error: "Diese Scheibe ist schon gelöscht." })
  })

  it("fremde, wartende und unbekannte Scheiben nicht; ohne Sitzung nichts", async () => {
    asOwner()
    const foreign = await card({ ownerId: otherId })
    const pending = await card({ pending: true })
    for (const id of [foreign, pending, "c0000000000000000000unknown"])
      expect(await deleteCard(id)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect((await stateOf(foreign))?.deletedAt).toBeNull()
    expect((await stateOf(pending))?.deletedAt).toBeNull()
    expect(await deleteCard("../x")).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    mocks.session = null
    expect(await deleteCard(foreign)).toEqual({
      error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an.",
    })
  })
})

describe("restoreCard", () => {
  it("holt eine eigene Scheibe aus dem Papierkorb zurück", async () => {
    asOwner()
    const id = await card()
    await deleteCard(id)
    expect(await restoreCard(id)).toEqual({ success: true })
    expect((await stateOf(id))?.deletedAt).toBeNull()
    expect(await restoreCard(id)).toEqual({
      error: "Diese Scheibe liegt nicht mehr im Papierkorb.",
    })
  })

  it("nach 30 Tagen nicht mehr; eine fremde nie", async () => {
    asOwner()
    const late = await card()
    await db.card.update({
      where: { id: late },
      data: { deletedAt: new Date(Date.now() - 31 * DAY_MS) },
    })
    expect(await restoreCard(late)).toEqual({
      error: "Die 30 Tage sind um. Die Scheibe lässt sich nicht mehr wiederherstellen.",
    })
    expect((await stateOf(late))?.deletedAt).not.toBeNull()

    const foreign = await card({ ownerId: otherId })
    await db.card.update({ where: { id: foreign }, data: { deletedAt: new Date() } })
    expect(await restoreCard(foreign)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect((await stateOf(foreign))?.deletedAt).not.toBeNull()
  })
})

describe("purgeCardNow", () => {
  it("löscht eine eigene Scheibe im Papierkorb endgültig, mit weicher Sperre", async () => {
    asOwner()
    const id = await card()
    const { scheibenId } = await db.card.findUniqueOrThrow({ where: { id } })
    expect(await purgeCardNow(id)).toEqual({
      error: "Diese Scheibe liegt nicht mehr im Papierkorb.",
    })
    expect(await stateOf(id)).not.toBeNull()

    await deleteCard(id)
    expect(await purgeCardNow(id)).toEqual({ success: true })
    expect(await stateOf(id)).toBeNull()
    expect(
      await db.deleteLock.count({
        where: { userId: site.ownerId, sourceId: site.sourceId, scheibenId: scheibenId! },
      })
    ).toBe(1)
    expect(await purgeCardNow(id)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
  })

  it("eine fremde nie", async () => {
    asOwner()
    const foreign = await card({ ownerId: otherId })
    await db.card.update({ where: { id: foreign }, data: { deletedAt: new Date() } })
    expect(await purgeCardNow(foreign)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    expect(await stateOf(foreign)).not.toBeNull()
  })
})

describe("Fehler der Datenbank", () => {
  it("als Text, kein Wurf", async () => {
    asOwner()
    const id = await card()
    const spy = vi.spyOn(db, "$transaction").mockRejectedValue(new Error("down"))
    try {
      for (const action of [deleteCard, restoreCard, purgeCardNow])
        expect(await action(id)).toEqual({
          error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen.",
        })
    } finally {
      spy.mockRestore()
    }
  })
})

describe("ein neuer Stand für eine Scheibe im Papierkorb (D10)", () => {
  it("wird geschrieben, die Scheibe bleibt im Papierkorb und in keiner Ansicht", async () => {
    asOwner()
    const [input] = generateSeason({
      seed: base,
      cards: 1,
      firstMs: Date.UTC(2026, 5, 2, 17) + base * 60_000,
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: base,
    })
    base += 1
    const id = (await writeRevision(db, { ...input, sequence: 1 })).cardId
    await deleteCard(id)
    // eine Korrektur der Wertung: der letzte Schuss fällt weg, eine neue Revision entsteht
    const result = await writeRevision(db, {
      ...input,
      sequence: 2,
      shots: input.shots.slice(0, -1),
    })
    expect(result.cardId).toBe(id)
    expect(await db.cardRevision.count({ where: { cardId: id } })).toBe(2)
    expect((await stateOf(id))?.deletedAt).not.toBeNull()
    expect((await ownerCards(db, { ownerId: site.ownerId })).map((c) => c.id)).not.toContain(id)
    expect((await trashCards(db, site.ownerId)).map((t) => t.card.id)).toContain(id)
  })
})
