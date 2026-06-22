import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  participantFindUniqueMock,
  participantDeleteMock,
  competitionParticipantCountMock,
  auditLogCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  participantFindUniqueMock: vi.fn(),
  participantDeleteMock: vi.fn(),
  competitionParticipantCountMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    participant: {
      findUnique: participantFindUniqueMock,
      delete: participantDeleteMock,
    },
    competitionParticipant: {
      count: competitionParticipantCountMock,
    },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import { deleteParticipant } from "@/lib/participants/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }
const userSession = { user: { id: "u2", role: "USER" } }

const inactiveParticipant = {
  id: "p1",
  firstName: "Max",
  lastName: "Muster",
  isActive: false,
}

describe("deleteParticipant (force=false)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    participantFindUniqueMock.mockResolvedValue(inactiveParticipant)
    competitionParticipantCountMock.mockResolvedValue(0)
    participantDeleteMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  it("returns error when not logged in", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error for USER role", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant not found", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Teilnehmer nicht gefunden." })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant is active", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue({ ...inactiveParticipant, isActive: true })
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Nur inaktive Teilnehmer können gelöscht werden." })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant has competition data", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    competitionParticipantCountMock.mockResolvedValue(3)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({
      error: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich.",
    })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("deletes participant without data as admin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ success: true })
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "p1" } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "PARTICIPANT_DELETED" }),
      })
    )
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("deletes participant without data as manager", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ success: true })
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "p1" } })
  })
})

describe("deleteParticipant (force=true)", () => {
  const txMock = {
    playoffMatch: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    playoffDuel: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    playoffDuelResult: { deleteMany: vi.fn().mockResolvedValue({}) },
    matchup: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    series: { deleteMany: vi.fn().mockResolvedValue({}) },
    competitionParticipant: { deleteMany: vi.fn().mockResolvedValue({}) },
    participant: { delete: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    participantFindUniqueMock.mockResolvedValue(inactiveParticipant)
    competitionParticipantCountMock.mockResolvedValue(2)
    auditLogCreateMock.mockResolvedValue({})
    transactionMock.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
      fn(txMock)
    )
    // Reset tx mocks
    txMock.playoffMatch.findMany.mockResolvedValue([])
    txMock.playoffMatch.deleteMany.mockResolvedValue({})
    txMock.playoffDuel.findMany.mockResolvedValue([])
    txMock.playoffDuel.deleteMany.mockResolvedValue({})
    txMock.playoffDuelResult.deleteMany.mockResolvedValue({})
    txMock.matchup.findMany.mockResolvedValue([])
    txMock.matchup.deleteMany.mockResolvedValue({})
    txMock.series.deleteMany.mockResolvedValue({})
    txMock.competitionParticipant.deleteMany.mockResolvedValue({})
    txMock.participant.delete.mockResolvedValue({})
    txMock.auditLog.create.mockResolvedValue({})
  })

  it("returns error when not admin (manager)", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("returns error when participant not found", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Teilnehmer nicht gefunden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("returns error when participant is active", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue({ ...inactiveParticipant, isActive: true })
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Nur inaktive Teilnehmer können gelöscht werden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("executes transaction and deletes participant", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(txMock.participant.delete).toHaveBeenCalledWith({ where: { id: "p1" } })
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "PARTICIPANT_FORCE_DELETED" }),
      })
    )
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("returns error when transaction throws", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB error"))
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Teilnehmer konnte nicht gelöscht werden." })
  })
})
