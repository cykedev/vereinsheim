import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { cardEvidenceList } from "./queries"

const db = createPrismaClient()
let site: TestSite
let otherId: string
beforeAll(async () => {
  site = await createTestSite(db, "evidence-queries")
  otherId = (
    await db.user.create({
      data: { email: `evidence-queries-${randomUUID()}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

async function card(data: { ownerId?: string; ownerPending?: boolean; deletedAt?: Date } = {}) {
  const created = await db.card.create({
    data: {
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      startedAt: new Date(),
      kind: "training",
      state: "final",
      complete: false,
      origin: "manual",
      ...data,
    },
  })
  return created.id
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 29, 10, minute))
const sha = (n: number) => n.toString(16).padStart(64, "0")

describe("cardEvidenceList", () => {
  it("in der Folge des Anhängens, mit Namen und Art; ohne Namen bleibt null", async () => {
    const id = await card()
    await db.cardEvidence.createMany({
      data: [
        {
          cardId: id,
          sha256: sha(2),
          contentType: "application/pdf",
          size: 200,
          fileName: "b.pdf",
          storedAt: at(2),
        },
        {
          cardId: id,
          sha256: sha(1),
          contentType: "image/jpeg",
          size: 100,
          fileName: null,
          storedAt: at(1),
        },
        {
          cardId: id,
          sha256: sha(3),
          contentType: "image/png",
          size: 300,
          fileName: "c.png",
          storedAt: at(3),
        },
      ],
    })
    const list = await cardEvidenceList(db, { cardId: id, ownerId: site.ownerId })
    expect(list.map(({ id: _id, ...rest }) => rest)).toEqual([
      { kind: "photo", name: null, size: 100, storedAtMs: at(1).getTime() },
      { kind: "pdf", name: "b.pdf", size: 200, storedAtMs: at(2).getTime() },
      { kind: "photo", name: "c.png", size: 300, storedAtMs: at(3).getTime() },
    ])
  })

  it("fremd, wartend und im Papierkorb: keine", async () => {
    const own = await card()
    const pending = await card({ ownerPending: true })
    const trashed = await card({ deletedAt: new Date() })
    for (const [i, id] of [own, pending, trashed].entries())
      await db.cardEvidence.create({
        data: { cardId: id, sha256: sha(10 + i), contentType: "image/jpeg", size: 1 },
      })
    expect(await cardEvidenceList(db, { cardId: own, ownerId: otherId })).toEqual([])
    expect(await cardEvidenceList(db, { cardId: pending, ownerId: site.ownerId })).toEqual([])
    expect(await cardEvidenceList(db, { cardId: trashed, ownerId: site.ownerId })).toEqual([])
    expect(await cardEvidenceList(db, { cardId: own, ownerId: site.ownerId })).toHaveLength(1)
  })
})
