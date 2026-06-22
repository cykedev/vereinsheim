import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  revalidateTagMock,
  competitionFindUniqueMock,
  competitionFindFirstMock,
  competitionDeleteMock,
  disciplineFindUniqueMock,
  competitionCreateMock,
  competitionUpdateMock,
  competitionParticipantCountMock,
  matchupCountMock,
  playoffMatchCountMock,
  transactionMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionFindFirstMock: vi.fn(),
  competitionDeleteMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
  competitionCreateMock: vi.fn(),
  competitionUpdateMock: vi.fn(),
  competitionParticipantCountMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    competition: {
      findUnique: competitionFindUniqueMock,
      findFirst: competitionFindFirstMock,
      create: competitionCreateMock,
      update: competitionUpdateMock,
      delete: competitionDeleteMock,
    },
    discipline: {
      findUnique: disciplineFindUniqueMock,
    },
    competitionParticipant: { count: competitionParticipantCountMock },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import {
  createCompetition,
  updateCompetition,
  setCompetitionStatus,
  deleteCompetition,
  forceDeleteCompetition,
} from "@/lib/competitions/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createCompetition ────────────────────────────────────────────────────────

describe("createCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionCreateMock.mockResolvedValue({})
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1" })
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createCompetition(
      null,
      makeFormData({ name: "Liga A", disciplineId: "d1" })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createCompetition(
      null,
      makeFormData({ name: "Liga A", disciplineId: "d1" })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("erlaubt MANAGER das Erstellen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    competitionCreateMock.mockResolvedValue({ id: "new1" })
    auditLogCreateMock.mockResolvedValue({})
    const fd = makeFormData({
      name: "Testwettbewerb",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      disciplineId: "d1",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ success: true })
  })

  it("liefert Validierungsfehler bei leerem Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createCompetition(null, makeFormData({ name: "", disciplineId: "d1" }))
    expect(result).toMatchObject({ error: { name: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei fehlendem Wertungsmodus", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createCompetition(null, makeFormData({ name: "Liga A", type: "LEAGUE" }))
    expect(result).toMatchObject({ error: { scoringMode: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Disziplin nicht existiert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue(null)
    const result = await createCompetition(
      null,
      makeFormData({
        name: "Liga A",
        type: "LEAGUE",
        scoringMode: "RINGTEILER",
        disciplineId: "d99",
      })
    )
    expect(result).toEqual({ error: "Disziplin nicht gefunden." })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("legt Wettbewerb an und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionCreateMock.mockResolvedValue({ id: "comp-1" })
    const result = await createCompetition(
      null,
      makeFormData({
        name: "Winterliga 2026",
        type: "LEAGUE",
        scoringMode: "RINGTEILER",
        disciplineId: "d1",
      })
    )
    expect(result).toMatchObject({ success: true })
    expect(competitionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Winterliga 2026",
        disciplineId: "d1",
        createdByUserId: "u1",
      }),
      select: expect.anything(),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateCompetition ────────────────────────────────────────────────────────

describe("updateCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionUpdateMock.mockResolvedValue({})
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Liga C",
      type: "LEAGUE",
      scoringMode: "RINGTEILER",
      status: "ACTIVE",
      isPublic: false,
      publicSlug: null,
      publicPasswordHash: null,
    })
    competitionFindFirstMock.mockResolvedValue(null)
    matchupCountMock.mockResolvedValue(0)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateCompetition("c1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateCompetition("c1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await updateCompetition("c99", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("ignoriert disciplineId im Update", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    await updateCompetition(
      "c1",
      null,
      makeFormData({ name: "Liga B", scoringMode: "RINGTEILER", disciplineId: "d-neu" })
    )
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.not.objectContaining({ disciplineId: expect.anything() }),
    })
  })

  it("aktualisiert Name und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateCompetition(
      "c1",
      null,
      makeFormData({ name: "Neuer Wettbewerb", scoringMode: "RINGTEILER" })
    )
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ name: "Neuer Wettbewerb" }),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateCompetition — Playoff-Konfiguration ───────────────────────────────

describe("updateCompetition — Playoff-Konfiguration editierbar bis Playoff-Start", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionUpdateMock.mockResolvedValue({})
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Liga P",
      type: "LEAGUE",
      scoringMode: "RINGTEILER",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      status: "ACTIVE",
      isPublic: false,
      publicSlug: null,
      publicPasswordHash: null,
    })
    competitionFindFirstMock.mockResolvedValue(null)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("erlaubt Playoff-Änderungen, solange Paarungen existieren, aber Playoffs nicht gestartet sind", async () => {
    matchupCountMock.mockResolvedValue(6) // Gruppenphase läuft
    playoffMatchCountMock.mockResolvedValue(0) // Playoffs noch nicht gestartet
    const fd = makeFormData({
      name: "Liga P",
      scoringMode: "RINGTEILER",
      playoffBestOf: "5",
      playoffHasViertelfinale: "true",
    })
    const result = await updateCompetition("c1", null, fd)
    expect(result).toMatchObject({ success: true })
    const data = competitionUpdateMock.mock.calls[0][0].data
    expect(data.playoffBestOf).toBe(5)
    expect(data.playoffHasViertelfinale).toBe(true)
  })

  it("sperrt Playoff-Änderungen, sobald die Playoffs gestartet sind", async () => {
    matchupCountMock.mockResolvedValue(6)
    playoffMatchCountMock.mockResolvedValue(1) // Playoffs gestartet
    const fd = makeFormData({
      name: "Liga P",
      scoringMode: "RINGTEILER",
      playoffBestOf: "5",
      playoffHasViertelfinale: "true",
    })
    const result = await updateCompetition("c1", null, fd)
    expect(result).toMatchObject({ success: true })
    const data = competitionUpdateMock.mock.calls[0][0].data
    expect(data.playoffBestOf).toBeUndefined()
    expect(data.playoffHasViertelfinale).toBeUndefined()
  })

  it("sperrt die Gruppenphase weiter bei Paarungen, lässt die Playoff-Felder aber zu", async () => {
    matchupCountMock.mockResolvedValue(6)
    playoffMatchCountMock.mockResolvedValue(0)
    const fd = makeFormData({
      name: "Liga P",
      scoringMode: "RINGS",
      shotsPerSeries: "40",
      playoffHasViertelfinale: "true",
    })
    await updateCompetition("c1", null, fd)
    const data = competitionUpdateMock.mock.calls[0][0].data
    // Gruppenphase/Format bleibt gesperrt …
    expect(data.scoringMode).toBeUndefined()
    expect(data.shotsPerSeries).toBeUndefined()
    // … die Playoff-Felder sind aber editierbar.
    expect(data.playoffHasViertelfinale).toBe(true)
  })
})

// ─── setCompetitionStatus ─────────────────────────────────────────────────────

describe("setCompetitionStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionUpdateMock.mockResolvedValue({})
    competitionFindFirstMock.mockResolvedValue(null)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await setCompetitionStatus("c1", "COMPLETED")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    expect(await setCompetitionStatus("c1", "COMPLETED")).toEqual({ error: "Keine Berechtigung" })
  })

  it("blockiert ungültigen Übergang ACTIVE → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    const result = await setCompetitionStatus("c1", "ARCHIVED")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
    expect(competitionUpdateMock).not.toHaveBeenCalled()
  })

  it("blockiert ungültigen Übergang ARCHIVED → ACTIVE", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ARCHIVED",
    })
    const result = await setCompetitionStatus("c1", "ACTIVE")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
  })

  it("erlaubt Übergang ACTIVE → COMPLETED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    const result = await setCompetitionStatus("c1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "COMPLETED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "COMPLETED",
    })
    const result = await setCompetitionStatus("c1", "ARCHIVED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ARCHIVED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ACTIVE (wieder öffnen)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "COMPLETED",
    })
    const result = await setCompetitionStatus("c1", "ACTIVE")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ACTIVE" },
    })
  })

  it("erlaubt Übergang ARCHIVED → COMPLETED (unarchivieren)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ARCHIVED",
    })
    const result = await setCompetitionStatus("c1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "COMPLETED" },
    })
  })
})

// ─── deleteCompetition ────────────────────────────────────────────────────────

describe("deleteCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionDeleteMock.mockResolvedValue({})
    competitionFindUniqueMock.mockResolvedValue({ id: "c1" })
    competitionParticipantCountMock.mockResolvedValue(0)
    matchupCountMock.mockResolvedValue(0)
    playoffMatchCountMock.mockResolvedValue(0)
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await deleteCompetition("c1")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    expect(await deleteCompetition("c1")).toEqual({ error: "Keine Berechtigung" })
  })

  it("erlaubt MANAGER das Löschen (ohne Daten)", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    competitionFindUniqueMock.mockResolvedValue({ id: "c1" })
    competitionParticipantCountMock.mockResolvedValue(0)
    matchupCountMock.mockResolvedValue(0)
    playoffMatchCountMock.mockResolvedValue(0)
    competitionDeleteMock.mockResolvedValue({})
    const result = await deleteCompetition("c1")
    expect(result).toEqual({ success: true })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    expect(await deleteCompetition("c99")).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("blockiert Löschen wenn Teilnehmer vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantCountMock.mockResolvedValue(3)
    const result = await deleteCompetition("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(competitionDeleteMock).not.toHaveBeenCalled()
  })

  it("blockiert Löschen wenn Paarungen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupCountMock.mockResolvedValue(1)
    const result = await deleteCompetition("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(competitionDeleteMock).not.toHaveBeenCalled()
  })

  it("löscht Wettbewerb ohne abhängige Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteCompetition("c1")
    expect(result).toEqual({ success: true })
    expect(competitionDeleteMock).toHaveBeenCalledWith({ where: { id: "c1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── forceDeleteCompetition ───────────────────────────────────────────────────

describe("forceDeleteCompetition", () => {
  const mockTx = {
    competitionParticipant: { findMany: vi.fn(), deleteMany: vi.fn() },
    matchup: { findMany: vi.fn(), deleteMany: vi.fn() },
    series: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffMatch: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuel: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuelResult: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    eventTeam: { deleteMany: vi.fn() },
    competition: { delete: vi.fn() },
  }

  function setupEmptyTx() {
    mockTx.competitionParticipant.findMany.mockResolvedValue([])
    mockTx.matchup.findMany.mockResolvedValue([])
    mockTx.series.findMany.mockResolvedValue([])
    mockTx.playoffMatch.findMany.mockResolvedValue([])
    mockTx.playoffDuel.findMany.mockResolvedValue([])
    mockTx.playoffDuelResult.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffDuel.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffMatch.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.series.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.matchup.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.auditLog.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.eventTeam.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.competitionParticipant.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.competition.delete.mockResolvedValue({})
    transactionMock.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) =>
      fn(mockTx)
    )
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ id: "c1", name: "Winterliga 2026" })
    setupEmptyTx()
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("verweigert MANAGER das endgültige Löschen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await forceDeleteCompetition("c1", "Testbewerb")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await forceDeleteCompetition("c99", "Winterliga 2026")
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler bei falschem Bestätigungsnamen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteCompetition("c1", "Falscher Wettbewerb")
    expect(result).toMatchObject({ error: expect.stringContaining("stimmt nicht") })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("löscht leeren Wettbewerb (ohne abhängige Daten)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ success: true })
    expect(mockTx.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("löscht Wettbewerb mit allen abhängigen Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)

    mockTx.competitionParticipant.findMany.mockResolvedValue([{ id: "cp1" }, { id: "cp2" }])
    mockTx.matchup.findMany.mockResolvedValue([{ id: "mu1" }, { id: "mu2" }])
    mockTx.series.findMany.mockResolvedValue([{ id: "mr1" }])
    mockTx.playoffMatch.findMany.mockResolvedValue([{ id: "pm1" }])
    mockTx.playoffDuel.findMany.mockResolvedValue([{ id: "pd1" }, { id: "pd2" }])

    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ success: true })

    // Bottom-up Löschreihenfolge
    expect(mockTx.playoffDuelResult.deleteMany).toHaveBeenCalledWith({
      where: { duelId: { in: ["pd1", "pd2"] } },
    })
    expect(mockTx.playoffDuel.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["pd1", "pd2"] } },
    })
    expect(mockTx.playoffMatch.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["pm1"] } },
    })
    expect(mockTx.series.deleteMany).toHaveBeenCalledWith({
      where: { matchupId: { in: ["mu1", "mu2"] } },
    })
    expect(mockTx.matchup.deleteMany).toHaveBeenCalledWith({ where: { competitionId: "c1" } })
    expect(mockTx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { competitionId: "c1" },
    })
    expect(mockTx.competitionParticipant.deleteMany).toHaveBeenCalledWith({
      where: { competitionId: "c1" },
    })
    expect(mockTx.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } })
  })

  it("liefert Fehler wenn Transaktion fehlschlägt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB error"))
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht gelöscht") })
  })
})

// ─── createCompetition — public slug ─────────────────────────────────────────

describe("createCompetition — public slug", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1" })
    competitionCreateMock.mockResolvedValue({ id: "new-id" })
    competitionFindFirstMock.mockResolvedValue(null) // no slug conflict by default
    auditLogCreateMock.mockResolvedValue({})
  })

  it("creates a competition with isPublic + slug", async () => {
    const fd = makeFormData({
      name: "Public Test",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "public-test-event",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ success: true })
    expect(competitionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublic: true, publicSlug: "public-test-event" }),
      })
    )
  })

  it("rejects a second ACTIVE+isPublic competition with the same slug", async () => {
    competitionFindFirstMock.mockResolvedValue({ id: "existing-id", name: "First" })
    const fd = makeFormData({
      name: "Second",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "conflict-slug",
    })
    const result = await createCompetition(null, fd)
    expect("error" in result && typeof result.error === "string").toBe(true)
    expect((result as { error: string }).error).toContain("'First'")
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })
})

// ─── updateCompetition — public slug ─────────────────────────────────────────

describe("updateCompetition — public slug", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Target",
      type: "EVENT",
      scoringMode: "RINGS",
      status: "ACTIVE",
      isPublic: false,
      publicSlug: null,
      publicPasswordHash: null,
    })
    competitionUpdateMock.mockResolvedValue({})
    competitionFindFirstMock.mockResolvedValue(null) // no slug conflict by default
    auditLogCreateMock.mockResolvedValue({})
  })

  it("rejects switching to a slug held by another ACTIVE+isPublic competition", async () => {
    competitionFindFirstMock.mockResolvedValue({ id: "other-id", name: "Other Active" })
    const fd = makeFormData({
      name: "Target",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "taken",
    })
    const result = await updateCompetition("c1", null, fd)
    expect("error" in result && typeof result.error === "string").toBe(true)
    expect((result as { error: string }).error).toContain("'Other Active'")
    expect(competitionUpdateMock).not.toHaveBeenCalled()
  })

  it("allows updating with own slug (no conflict with self)", async () => {
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "My Competition",
      type: "EVENT",
      scoringMode: "RINGS",
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "my-slug",
      publicPasswordHash: null,
    })
    competitionFindFirstMock.mockResolvedValue(null) // self-exclusion works
    const fd = makeFormData({
      name: "My Competition",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "my-slug",
    })
    const result = await updateCompetition("c1", null, fd)
    expect(result).toMatchObject({ success: true })
  })
})

// ─── setCompetitionStatus — public slug ──────────────────────────────────────

describe("setCompetitionStatus — public slug", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionUpdateMock.mockResolvedValue({})
    competitionFindFirstMock.mockResolvedValue(null) // no slug conflict by default
    auditLogCreateMock.mockResolvedValue({})
  })

  it("blocks transition to ACTIVE when another ACTIVE+isPublic holds the slug", async () => {
    competitionFindUniqueMock.mockResolvedValue({
      id: "draft-id",
      name: "Next Year",
      status: "DRAFT",
      isPublic: true,
      publicSlug: "year-cup",
    })
    competitionFindFirstMock.mockResolvedValue({ id: "holder-id", name: "Holder" })

    const result = await setCompetitionStatus("draft-id", "ACTIVE")
    expect("error" in result && typeof result.error === "string").toBe(true)
    expect((result as { error: string }).error).toContain("'Holder'")
    expect(competitionUpdateMock).not.toHaveBeenCalled()
  })

  it("allows DRAFT → ACTIVE when no slug conflict exists", async () => {
    competitionFindUniqueMock.mockResolvedValue({
      id: "draft-id",
      name: "New Competition",
      status: "DRAFT",
      isPublic: true,
      publicSlug: "free-slug",
    })
    competitionFindFirstMock.mockResolvedValue(null)

    const result = await setCompetitionStatus("draft-id", "ACTIVE")
    expect(result).toMatchObject({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    )
  })
})

// ─── updateCompetition — public password ─────────────────────────────────────

describe("updateCompetition — public password", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Pw Target",
      type: "EVENT",
      scoringMode: "RINGS",
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "pw-target",
      publicPasswordHash: null,
    })
    competitionUpdateMock.mockResolvedValue({})
    competitionFindFirstMock.mockResolvedValue(null)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("stores a bcrypt hash when password is provided (never stores plaintext)", async () => {
    const fd = makeFormData({
      name: "Pw Target",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "pw-target",
      publicPassword: "geheim",
    })
    await updateCompetition("c1", null, fd)
    const updateCall = competitionUpdateMock.mock.calls[0][0]
    const hash = updateCall.data.publicPasswordHash
    expect(hash).toBeTruthy()
    expect(hash).not.toContain("geheim") // never store plaintext
    expect(hash).toMatch(/^\$2[ab]\$/) // bcrypt hash format
  })

  it("leaves existing hash unchanged when password input is empty", async () => {
    const existingHash = "$2a$12$existinghashplaceholderfortest"
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Keep Pw",
      type: "EVENT",
      scoringMode: "RINGS",
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "keep-pw",
      publicPasswordHash: existingHash,
    })
    const fd = makeFormData({
      name: "Keep Pw",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "keep-pw",
      // publicPassword intentionally NOT set
    })
    await updateCompetition("c1", null, fd)
    const updateCall = competitionUpdateMock.mock.calls[0][0]
    // undefined means Prisma should NOT touch the column
    expect(updateCall.data.publicPasswordHash).toBeUndefined()
  })

  it("clears the hash when removePublicPassword is checked", async () => {
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Clear Pw",
      type: "EVENT",
      scoringMode: "RINGS",
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "clear-pw",
      publicPasswordHash: "$2a$12$existinghash",
    })
    const fd = makeFormData({
      name: "Clear Pw",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "clear-pw",
      removePublicPassword: "on",
    })
    await updateCompetition("c1", null, fd)
    const updateCall = competitionUpdateMock.mock.calls[0][0]
    expect(updateCall.data.publicPasswordHash).toBeNull()
  })

  it("rejects passwords shorter than 4 characters", async () => {
    const fd = makeFormData({
      name: "Short Pw",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      isPublic: "on",
      publicSlug: "pw-target",
      publicPassword: "abc",
    })
    const result = await updateCompetition("c1", null, fd)
    // Zod validation error — action should not update the DB
    expect(competitionUpdateMock).not.toHaveBeenCalled()
    expect(result).toBeTruthy() // returns some error form
  })
})

// ─── BEST_OF_SINGLE — createCompetition ──────────────────────────────────────

describe("createCompetition — BEST_OF_SINGLE", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1" })
    competitionCreateMock.mockResolvedValue({ id: "comp-bos" })
    competitionFindFirstMock.mockResolvedValue(null)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("legt BEST_OF_SINGLE Liga an und persistiert Gruppenphase-Felder", async () => {
    const fd = makeFormData({
      name: "Best-of-3 Liga",
      type: "LEAGUE",
      scoringMode: "RINGS",
      disciplineId: "d1",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "3",
      groupPlayAllDuels: "on",
      groupHasSuddenDeath: "on",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ success: true })
    expect(competitionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueFormat: "BEST_OF_SINGLE",
          groupBestOf: 3,
          groupPlayAllDuels: true,
          groupHasSuddenDeath: true,
          groupTiebreaker1: null,
          groupTiebreaker2: null,
        }),
      })
    )
  })

  it("lehnt geraden groupBestOf-Wert ab", async () => {
    const fd = makeFormData({
      name: "Fehlerhaft",
      type: "LEAGUE",
      scoringMode: "RINGS",
      disciplineId: "d1",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "4",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ error: { groupBestOf: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("lehnt scoringMode DECIMAL_REST für BEST_OF_SINGLE ab", async () => {
    const fd = makeFormData({
      name: "Fehlerhaft",
      type: "LEAGUE",
      scoringMode: "DECIMAL_REST",
      disciplineId: "d1",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "3",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ error: { scoringMode: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("lehnt TARGET_ABSOLUTE scoringMode für BEST_OF_SINGLE ab", async () => {
    const fd = makeFormData({
      name: "Fehlerhaft",
      type: "LEAGUE",
      scoringMode: "TARGET_ABSOLUTE",
      disciplineId: "d1",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "3",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ error: { scoringMode: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("DOUBLE_ROUND_ROBIN-Erstellung bleibt unverändert", async () => {
    const fd = makeFormData({
      name: "Klassische Liga",
      type: "LEAGUE",
      scoringMode: "RINGTEILER",
      disciplineId: "d1",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ success: true })
    expect(competitionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueFormat: "DOUBLE_ROUND_ROBIN",
          scoringMode: "RINGTEILER",
        }),
      })
    )
  })
})

// ─── BEST_OF_SINGLE — updateCompetition ──────────────────────────────────────

describe("updateCompetition — BEST_OF_SINGLE", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "BOS Liga",
      type: "LEAGUE",
      scoringMode: "RINGS",
      leagueFormat: "BEST_OF_SINGLE",
      status: "ACTIVE",
      isPublic: false,
      publicSlug: null,
      publicPasswordHash: null,
    })
    competitionFindFirstMock.mockResolvedValue(null)
    matchupCountMock.mockResolvedValue(0)
    competitionUpdateMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  it("aktualisiert BEST_OF_SINGLE-Felder, solange kein Spielplan existiert", async () => {
    const fd = makeFormData({
      name: "BOS Liga",
      scoringMode: "RINGS",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "5",
      groupPlayAllDuels: "on",
      groupHasSuddenDeath: "on",
    })
    const result = await updateCompetition("c1", null, fd)
    expect(result).toMatchObject({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueFormat: "BEST_OF_SINGLE",
          groupBestOf: 5,
          groupPlayAllDuels: true,
        }),
      })
    )
  })

  it("sperrt leagueFormat-Änderung sobald ein Spielplan existiert", async () => {
    // Schedule exists
    matchupCountMock.mockResolvedValue(3)
    const fd = makeFormData({
      name: "BOS Liga",
      scoringMode: "RINGS",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      groupBestOf: "3",
    })
    const result = await updateCompetition("c1", null, fd)
    // Action succeeds but ignores the locked fields
    expect(result).toMatchObject({ success: true })
    const updateCall = competitionUpdateMock.mock.calls[0][0]
    // leagueFormat must NOT appear in the update data once locked
    expect(updateCall.data.leagueFormat).toBeUndefined()
    expect(updateCall.data.groupBestOf).toBeUndefined()
    expect(updateCall.data.groupPlayAllDuels).toBeUndefined()
  })

  it("sperrt groupBestOf-Änderung sobald ein Spielplan existiert", async () => {
    matchupCountMock.mockResolvedValue(1)
    const fd = makeFormData({
      name: "BOS Liga",
      scoringMode: "RINGS",
      leagueFormat: "BEST_OF_SINGLE",
      groupBestOf: "7",
    })
    await updateCompetition("c1", null, fd)
    const updateCall = competitionUpdateMock.mock.calls[0][0]
    expect(updateCall.data.groupBestOf).toBeUndefined()
  })
})
