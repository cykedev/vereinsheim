import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { projectionVersion } from "@vereinsheim/shot-core/projection"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

// eine Scheibe, an der die Rechnung scheitert (etwa eine neue Kennzahl an einem Sonderfall); die übrigen sollen trotzdem
// nachgerechnet werden
const mocks = vi.hoisted(() => ({ failing: null as string | null }))
vi.mock("@vereinsheim/shot-core/projection", async (importOriginal) => {
  const original = await importOriginal<typeof import("@vereinsheim/shot-core/projection")>()
  return {
    ...original,
    cardProjection: (card: Parameters<typeof original.cardProjection>[0]) => {
      if (card.id === mocks.failing) throw new Error("Rechnung scheitert an dieser Scheibe")
      return original.cardProjection(card)
    },
  }
})

const { refreshStaleProjections, writeRevision } = await import("./cards")

const db = createPrismaClient()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "refresh")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

describe("refreshStaleProjections", () => {
  it("eine scheiternde Scheibe hält die übrigen nicht auf; sie bleibt veraltet und wird gemeldet", async () => {
    const inputs = generateSeason({
      seed: 3,
      cards: 5,
      firstMs: Date.UTC(2026, 2, 1, 17),
      everyDays: 2,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: 7000,
    })
    const ids: string[] = []
    for (const input of inputs) ids.push((await writeRevision(db, input)).cardId)
    await db.cardProjection.updateMany({
      where: { cardId: { in: ids } },
      data: { version: "p1-alt" },
    })
    // die mit der kleinsten Id scheitert: sie stünde in jedem Stapel vorn
    mocks.failing = [...ids].sort()[0]
    const failures: string[] = []
    const done = await refreshStaleProjections(db, {
      batch: 2,
      sourceId: site.sourceId,
      onFailure: (id) => failures.push(id),
    })
    expect(done).toBe(4)
    expect(failures).toEqual([mocks.failing])
    const rows = await db.cardProjection.findMany({ where: { cardId: { in: ids } } })
    const current = rows.filter((row) => row.version === projectionVersion()).map((r) => r.cardId)
    expect(current.sort()).toEqual(ids.filter((id) => id !== mocks.failing).sort())

    // beim nächsten Start ohne Fehler wird auch sie nachgerechnet
    mocks.failing = null
    expect(await refreshStaleProjections(db, { batch: 2, sourceId: site.sourceId })).toBe(1)
  })
})
