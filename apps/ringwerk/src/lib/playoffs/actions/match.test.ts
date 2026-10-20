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
const { transaction, auditLogCreate } = vi.hoisted(() => ({
  transaction: vi.fn(),
  auditLogCreate: vi.fn(),
}))
vi.mock("@/lib/db", () => {
  const playoffMatch = { findMany, create, createMany, count: vi.fn().mockResolvedValue(4) }
  const auditLog = { create: auditLogCreate }
  transaction.mockImplementation(
    (fn: (tx: { playoffMatch: typeof playoffMatch; auditLog: typeof auditLog }) => unknown) =>
      fn({ playoffMatch, auditLog })
  )
  return { db: { playoffMatch, auditLog, $transaction: transaction } }
})

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

describe("advanceRound: Halbfinale aus dem Viertelfinale", () => {
  const QUARTERS = ["a", "b", "c", "d"].map((x, i) => ({
    id: `q${i}`,
    round: "QUARTER_FINAL",
    status: "COMPLETED",
    winsA: 3,
    winsB: 0,
    participantAId: `${x}1`,
    participantBId: `${x}2`,
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    getAuthSession.mockResolvedValue({ user: { id: "u1", role: "MANAGER" } })
    findMany.mockImplementation((args: { where: { round?: string } }) =>
      Promise.resolve(QUARTERS.filter((m) => !args.where.round || m.round === args.where.round))
    )
    createMany.mockResolvedValue({ count: 2 })
  })

  it("legt das Halbfinale an und schreibt „Playoff-Runde angelegt“ mit dieser Runde", async () => {
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(createMany).toHaveBeenCalledTimes(1)
    expect(auditLogCreate).toHaveBeenCalledTimes(1)
    expect(auditLogCreate.mock.calls[0][0].data.details).toEqual({ round: "SEMI_FINAL" })
  })
})

describe("advanceRound: Finale", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthSession.mockResolvedValue({ user: { id: "u1", role: "MANAGER" } })
    findMany.mockImplementation(rowsLikePostgres)
    create.mockResolvedValue({})
  })

  it("setzt den Sieger des oberen Halbfinales als A, unabhängig von der Zeilenfolge", async () => {
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: { competitionId: "c1", round: "FINAL", participantAId: "p1", participantBId: "p4" },
    })
  })

  it("schreibt einen Eintrag „Playoff-Runde angelegt“ in der Transaktion", async () => {
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(auditLogCreate).toHaveBeenCalledTimes(1)
    expect(auditLogCreate.mock.calls[0][0].data).toEqual({
      eventType: "PLAYOFF_ROUND_CREATED",
      entityType: "COMPETITION",
      entityId: "c1",
      userId: "u1",
      competitionId: "c1",
      details: { round: "FINAL" },
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
    expect(auditLogCreate).not.toHaveBeenCalled()
  })
})
