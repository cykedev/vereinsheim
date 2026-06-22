import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  revalidateTagMock,
  matchupFindUniqueMock,
  competitionFindUniqueMock,
  competitionParticipantFindFirstMock,
  transactionMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  matchupFindUniqueMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    matchup: { findUnique: matchupFindUniqueMock },
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: { findFirst: competitionParticipantFindFirstMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import { saveMatchResult } from "@/lib/results/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

const matchupBase = {
  id: "m1",
  status: "PENDING",
  round: 1,
  dueDate: new Date("2026-03-15"),
  homeParticipantId: "p1",
  homeParticipant: { firstName: "Anna", lastName: "Schmidt" },
  awayParticipantId: "p2",
  awayParticipant: { firstName: "Klaus", lastName: "Meyer" },
  competitionId: "c1",
  competition: {
    shotsPerSeries: 30,
    discipline: {
      id: "d1",
      scoringType: "WHOLE" as const,
      teilerFaktor: { toNumber: () => 1.0 },
    },
  },
  series: [],
}

const resultInput = {
  homeResult: { rings: 95, teiler: 123.4 },
  awayResult: { rings: 92, teiler: 145.0 },
}

function makeTransactionMock() {
  return async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      series: { upsert: vi.fn().mockResolvedValue({}) },
      matchup: { update: vi.fn().mockResolvedValue({}) },
    }
    return fn(tx)
  }
}

// ─── saveMatchResult ──────────────────────────────────────────────────────────

describe("saveMatchResult", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    matchupFindUniqueMock.mockResolvedValue(matchupBase)
    // Default: competition is not public — revalidatePublicSlugForCompetition no-ops
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    transactionMock.mockImplementation(makeTransactionMock())
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("speichert Ergebnis mit MANAGER-Berechtigung", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    matchupFindUniqueMock.mockResolvedValue({ ...matchupBase, series: [] })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalled()
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_ENTERED" }),
      })
    )
  })

  it("liefert Fehler wenn Matchup nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(null)
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Paarung nicht gefunden." })
  })

  it("liefert Fehler wenn Matchup BYE ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({ ...matchupBase, status: "BYE" })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Freilos-Paarungen haben keine Ergebnisse." })
  })

  it("liefert Fehler wenn kein Away-Participant", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({
      ...matchupBase,
      awayParticipantId: null,
      awayParticipant: null,
    })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Ungültige Paarung: kein Gegner zugeordnet." })
  })

  it("liefert Fehler wenn weder Competition- noch Teilnehmer-Disziplin konfiguriert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({
      ...matchupBase,
      competition: { shotsPerSeries: 30, discipline: null },
    })
    competitionParticipantFindFirstMock.mockResolvedValue(null)
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Disziplin nicht konfiguriert." })
  })

  it("speichert Ergebnis für gemischte Liga (per-Teilnehmer Disziplin)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({
      ...matchupBase,
      competition: { shotsPerSeries: 30, discipline: null },
      series: [],
    })
    const discipline = {
      id: "d1",
      scoringType: "WHOLE" as const,
      teilerFaktor: { toNumber: () => 1.0 },
    }
    competitionParticipantFindFirstMock.mockResolvedValue({ discipline })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalled()
  })

  it("speichert Ersterfassung und schreibt auditLog RESULT_ENTERED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({ ...matchupBase, series: [] })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalled()
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_ENTERED" }),
      })
    )
  })

  it("speichert Korrektur und schreibt auditLog RESULT_CORRECTED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({ ...matchupBase, series: [{ id: "s1" }] })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ success: true })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_CORRECTED" }),
      })
    )
  })

  it("liefert generischen Fehler bei Transaction-Exception", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB connection lost"))
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Ergebnis konnte nicht gespeichert werden." })
  })

  it("feste Disziplin: Ringteiler ohne Faktor (LP 0.333 → effektiv 1.0)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const seriesUpsertMock = vi.fn().mockResolvedValue({})
    matchupFindUniqueMock.mockResolvedValue({
      ...matchupBase,
      competition: {
        shotsPerSeries: 10,
        disciplineId: "d-lp",
        discipline: {
          id: "d-lp",
          scoringType: "WHOLE",
          teilerFaktor: { toNumber: () => 0.3333333 },
        },
      },
      series: [],
    })
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: seriesUpsertMock },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })
    await saveMatchResult("m1", {
      homeResult: { rings: 90, teiler: 60 },
      awayResult: { rings: 90, teiler: 60 },
    })
    const homeCall = seriesUpsertMock.mock.calls[0][0]
    expect(homeCall.create.ringteiler).toBe(70)
    expect(homeCall.update.ringteiler).toBe(70)
  })
})
