import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionParticipantFindUniqueMock,
  competitionParticipantCreateMock,
  competitionParticipantDeleteMock,
  competitionParticipantUpdateMock,
  matchupCountMock,
  playoffMatchCountMock,
  participantCreateMock,
  participantDeleteMock,
  seriesDeleteManyMock,
  transactionMock,
  auditLogCreateMock,
  disciplineFindUniqueMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindUniqueMock: vi.fn(),
  competitionParticipantCreateMock: vi.fn(),
  competitionParticipantDeleteMock: vi.fn(),
  competitionParticipantUpdateMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  participantCreateMock: vi.fn(),
  participantDeleteMock: vi.fn(),
  seriesDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: {
      findUnique: competitionParticipantFindUniqueMock,
      findFirst: competitionParticipantFindUniqueMock,
      create: competitionParticipantCreateMock,
      delete: competitionParticipantDeleteMock,
      update: competitionParticipantUpdateMock,
    },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    participant: {
      create: participantCreateMock,
      delete: participantDeleteMock,
    },
    series: { deleteMany: seriesDeleteManyMock },
    auditLog: { create: auditLogCreateMock },
    discipline: { findUnique: disciplineFindUniqueMock },
    $transaction: transactionMock,
  },
}))

import {
  enrollParticipant,
  unenrollParticipant,
  withdrawParticipant,
  revokeWithdrawal,
  updateStartNumber,
  updateParticipantDiscipline,
} from "@/lib/competitionParticipants/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const activeCompetition = { id: "c1", status: "ACTIVE", disciplineId: "d1" }

// ─── enrollParticipant ────────────────────────────────────────────────────────

describe("enrollParticipant", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue(activeCompetition)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    competitionParticipantCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("liefert Validierungsfehler wenn kein Teilnehmer und kein Gast", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant("c1", null, makeFormData({ isGuest: "false" }))
    expect(result).toMatchObject({ error: { participantId: expect.any(Array) } })
    expect(competitionParticipantCreateMock).not.toHaveBeenCalled()
  })

  it("schreibt regulären Teilnehmer ein", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ participantId: "p1", isGuest: "false" })
    )
    expect(result).toEqual({ success: true })
    expect(competitionParticipantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participantId: "p1", isGuest: false }),
      })
    )
  })

  it("erlaubt MANAGER das Einschreiben", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ participantId: "p1", isGuest: "false" })
    )
    expect(result).toEqual({ success: true })
    expect(competitionParticipantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participantId: "p1", isGuest: false }),
      })
    )
  })

  it("liefert Fehler bei doppelter Einschreibung", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({ id: "cp1" })
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ participantId: "p1", isGuest: "false" })
    )
    expect(result).toEqual({ error: "Teilnehmer ist bereits in diesem Wettbewerb eingeschrieben." })
  })

  it("liefert Validierungsfehler wenn Gast ohne Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ isGuest: "true", guestName: "" })
    )
    expect(result).toMatchObject({ error: { guestName: expect.any(Array) } })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("schreibt Gast mit Namen ein (stiller Participant-Record)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        participant: {
          create: participantCreateMock.mockResolvedValue({ id: "gp1" }),
        },
        competitionParticipant: {
          create: competitionParticipantCreateMock,
        },
      }
      return fn(tx)
    })
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ isGuest: "true", guestName: "Max Mustermann" })
    )
    expect(result).toEqual({ success: true })
    expect(participantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Max Mustermann",
          lastName: "",
          isGuestRecord: true,
        }),
      })
    )
    expect(competitionParticipantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isGuest: true, participantId: "gp1" }),
      })
    )
  })
})

// ─── unenrollParticipant ────────────────────────────────────────────────────

describe("unenrollParticipant", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    matchupCountMock.mockResolvedValue(0)
    competitionParticipantDeleteMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "p1",
      isGuest: false,
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("löscht regulären Teilnehmer ohne Cleanup", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "p1",
      isGuest: false,
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ success: true })
    expect(competitionParticipantDeleteMock).toHaveBeenCalledWith({ where: { id: "cp1" } })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("erlaubt MANAGER das Abmelden", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "p1",
      isGuest: false,
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ success: true })
    expect(competitionParticipantDeleteMock).toHaveBeenCalledWith({ where: { id: "cp1" } })
  })

  it("löscht Gast inklusive Serien und stillem Participant-Record", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "gp1",
      isGuest: true,
    })
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { deleteMany: seriesDeleteManyMock.mockResolvedValue({}) },
        competitionParticipant: { delete: competitionParticipantDeleteMock },
        participant: { delete: participantDeleteMock.mockResolvedValue({}) },
      }
      return fn(tx)
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ success: true })
    expect(seriesDeleteManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ participantId: "gp1", competitionId: "c1" }),
      })
    )
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "gp1" } })
  })
})

// ─── withdrawParticipant ──────────────────────────────────────────────────────

describe("withdrawParticipant", () => {
  const activeCp = {
    id: "cp1",
    competitionId: "c1",
    participantId: "p1",
    status: "ACTIVE",
    participant: { firstName: "Max", lastName: "Mustermann" },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(activeCp)
    playoffMatchCountMock.mockResolvedValue(0)
    transactionMock.mockResolvedValue([{}, {}])
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Einschreibung nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn bereits zurückgezogen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({ ...activeCp, status: "WITHDRAWN" })
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Teilnehmer ist bereits zurückgezogen." })
  })

  it("liefert Fehler wenn Playoffs bereits begonnen haben", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    playoffMatchCountMock.mockResolvedValue(1)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Rückzug nicht möglich — Playoffs haben bereits begonnen." })
  })

  it("zieht Teilnehmer zurück und ruft Transaktion auf", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await withdrawParticipant("cp1", null, makeFormData({ reason: "Verletzt" }))
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array))
  })

  it("erlaubt MANAGER den Rückzug", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await withdrawParticipant("cp1", null, makeFormData({ reason: "Verletzt" }))
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array))
  })
})

// ─── revokeWithdrawal ─────────────────────────────────────────────────────────

describe("revokeWithdrawal", () => {
  const withdrawnCp = {
    id: "cp1",
    competitionId: "c1",
    participantId: "p1",
    status: "WITHDRAWN",
    participant: { firstName: "Max", lastName: "Mustermann" },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(withdrawnCp)
    playoffMatchCountMock.mockResolvedValue(0)
    transactionMock.mockResolvedValue([{}, {}])
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Einschreibung nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn Teilnehmer nicht zurückgezogen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({ ...withdrawnCp, status: "ACTIVE" })
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Teilnehmer ist nicht zurückgezogen." })
  })

  it("liefert Fehler wenn Playoffs bereits begonnen haben", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    playoffMatchCountMock.mockResolvedValue(1)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({
      error: "Rückzug kann nicht rückgängig gemacht werden — Playoffs haben bereits begonnen.",
    })
  })

  it("macht Rückzug rückgängig und ruft Transaktion auf", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array))
  })

  it("erlaubt MANAGER das Rückgängigmachen des Rückzugs", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array))
  })
})

// ─── updateStartNumber ────────────────────────────────────────────────────────

describe("updateStartNumber", () => {
  const cp = { id: "cp1", competitionId: "c1" }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(cp)
    competitionParticipantUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Einschreibung nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("aktualisiert Startnummer auf eine Zahl", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { startNumber: 7 } })
    )
  })

  it("aktualisiert Startnummer auf null", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateStartNumber("cp1", null)
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { startNumber: null } })
    )
  })

  it("erlaubt MANAGER das Aktualisieren der Startnummer", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { startNumber: 7 } })
    )
  })
})

// ─── updateParticipantDiscipline ─────────────────────────────────────────────

describe("updateParticipantDiscipline", () => {
  const activeCp = {
    id: "cp1",
    competitionId: "c1",
    status: "ACTIVE",
    _count: { series: 0 },
  }
  const activeDiscipline = { id: "d2", isArchived: false }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(activeCp)
    disciplineFindUniqueMock.mockResolvedValue(activeDiscipline)
    competitionParticipantUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin/Manager", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn Status WITHDRAWN", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      ...activeCp,
      status: "WITHDRAWN",
    })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({
      error: "Disziplin kann nur bei aktiven Teilnehmern geändert werden.",
    })
  })

  it("liefert Fehler wenn Serien vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      ...activeCp,
      _count: { series: 1 },
    })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({
      error: "Disziplin kann nicht mehr geändert werden — es gibt bereits erfasste Serien.",
    })
  })

  it("liefert Fehler wenn Disziplin nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Disziplin nicht gefunden oder nicht verfügbar." })
  })

  it("liefert Fehler wenn Disziplin archiviert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d2", isArchived: true })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Disziplin nicht gefunden oder nicht verfügbar." })
  })

  it("aktualisiert Disziplin erfolgreich", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith({
      where: { id: "cp1" },
      data: { disciplineId: "d2" },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions/c1/participants")
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions")
  })

  it("erlaubt MANAGER die Änderung", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ success: true })
  })
})
