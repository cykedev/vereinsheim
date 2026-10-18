import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, create, createMany, getAuthSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  getAuthSession: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/competitions/publicPdfCache", () => ({ revalidatePublicPdf: vi.fn() }))
vi.mock("@/lib/playoffs/queries", () => ({ getSeedingStandings: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/db", () => ({
  db: { playoffMatch: { findMany, create, createMany, count: vi.fn().mockResolvedValue(4) } },
}))

import { advanceRound } from "./match"

// Zwei fertige Halbfinals in der Reihenfolge, in der Ringwerk sie angelegt hat (gleiche Zeit aus einem `createMany`):
// oben gewinnt A (p1), unten gewinnt B (p4).
const SEMIS = [
  {
    id: "c01",
    round: "SEMI_FINAL",
    status: "COMPLETED",
    winsA: 3,
    winsB: 1,
    participantAId: "p1",
    participantBId: "p2",
  },
  {
    id: "c02",
    round: "SEMI_FINAL",
    status: "COMPLETED",
    winsA: 0,
    winsB: 3,
    participantAId: "p3",
    participantBId: "p4",
  },
]

/** wie Postgres bei Gleichstand: nur mit `createdAt, id` in der Reihenfolge der Anlage, sonst andersherum */
function rowsLikePostgres(args: { where: { round?: string }; orderBy?: unknown }) {
  const rows = SEMIS.filter((m) => !args.where.round || m.round === args.where.round)
  const ordered =
    JSON.stringify(args.orderBy) === JSON.stringify([{ createdAt: "asc" }, { id: "asc" }])
  return Promise.resolve(ordered ? rows : [...rows].reverse())
}

describe("advanceRound: Finale", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthSession.mockResolvedValue({ user: { id: "u1", role: "MANAGER" } })
    findMany.mockImplementation(rowsLikePostgres)
    create.mockResolvedValue({})
  })

  it("setzt den Sieger des oberen Halbfinales als A, unabhängig von der Zeilenfolge", async () => {
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: { competitionId: "c1", round: "FINAL", participantAId: "p1", participantBId: "p4" },
    })
  })

  it("meldet eine unvollständige Runde, statt ein Finale mit nur einem Teilnehmer anzulegen", async () => {
    // der Runde fehlt ein Halbfinale
    findMany.mockImplementation((args: { where: { round?: string }; orderBy?: unknown }) =>
      rowsLikePostgres(args).then((rows) => rows.slice(0, 1))
    )
    const result = await advanceRound("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("fehlt eine Paarung") })
    expect(result).toMatchObject({ error: expect.stringContaining("Halbfinale anlegen") })
    expect(create).not.toHaveBeenCalled()
  })
})
