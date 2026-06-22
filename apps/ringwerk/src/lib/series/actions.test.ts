import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionParticipantFindUniqueMock,
  competitionParticipantFindFirstMock,
  disciplineFindUniqueMock,
  seriesFindUniqueMock,
  seriesCreateMock,
  seriesUpdateMock,
  seriesDeleteMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindUniqueMock: vi.fn(),
  competitionParticipantFindFirstMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
  seriesFindUniqueMock: vi.fn(),
  seriesCreateMock: vi.fn(),
  seriesUpdateMock: vi.fn(),
  seriesDeleteMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
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
      findFirst: competitionParticipantFindFirstMock,
    },
    discipline: { findUnique: disciplineFindUniqueMock },
    series: {
      findUnique: seriesFindUniqueMock,
      create: seriesCreateMock,
      update: seriesUpdateMock,
      delete: seriesDeleteMock,
    },
    auditLog: { create: auditLogCreateMock },
  },
}))

import {
  saveEventSeries,
  deleteEventSeries,
  saveSeasonSeries,
  updateSeasonSeries,
  deleteSeasonSeries,
} from "@/lib/series/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const discipline = {
  id: "d1",
  name: "10m Luftgewehr",
  scoringType: "WHOLE" as const,
  teilerFaktor: { toNumber: () => 1.0 },
}

const eventCompetition = {
  id: "c1",
  type: "EVENT",
  status: "ACTIVE",
  scoringMode: "RINGTEILER" as const,
  shotsPerSeries: 30,
  disciplineId: "d1",
}

const seasonCompetition = {
  id: "c2",
  type: "SEASON",
  status: "ACTIVE",
  scoringMode: "RINGTEILER" as const,
  shotsPerSeries: 30,
  disciplineId: "d1",
}

const cpWithDiscipline = {
  id: "cp1",
  participantId: "p1",
  disciplineId: "d1",
  discipline,
  participant: { firstName: "Max", lastName: "Mustermann" },
}

const cpWithoutDiscipline = {
  id: "cp1",
  participantId: "p1",
  disciplineId: null,
  discipline: null,
  participant: { firstName: "Max", lastName: "Mustermann" },
}

// ─── saveEventSeries ──────────────────────────────────────────────────────────

describe("saveEventSeries", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue(eventCompetition)
    competitionParticipantFindUniqueMock.mockResolvedValue(cpWithDiscipline)
    seriesFindUniqueMock.mockResolvedValue(null)
    seriesCreateMock.mockResolvedValue({ id: "s1" })
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({ rings: "95", teiler: "123.4" })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn Competition nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("liefert Fehler wenn Competition kein EVENT ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...eventCompetition, type: "SEASON" })
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Nur für Event-Wettbewerbe." })
  })

  it("liefert Fehler wenn Competition ARCHIVED ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...eventCompetition, status: "ARCHIVED" })
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Archivierte Wettbewerbe sind gesperrt." })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." })
  })

  it("liefert Validierungsfehler bei fehlenden Ringen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await saveEventSeries(
      "c1",
      "cp1",
      null,
      makeFormData({ rings: "", teiler: "123.4" })
    )
    expect(result).toMatchObject({ error: { rings: expect.any(Array) } })
    expect(seriesCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei negativem Teiler", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await saveEventSeries(
      "c1",
      "cp1",
      null,
      makeFormData({ rings: "95", teiler: "-1" })
    )
    expect(result).toMatchObject({ error: { teiler: expect.any(Array) } })
  })

  it("legt neue Serie an wenn keine vorhanden (create)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue(null)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(seriesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rings: 95, teiler: 123.4, competitionId: "c1" }),
      })
    )
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "EVENT_SERIES_ENTERED" }),
      })
    )
  })

  it("korrigiert bestehende Serie (update)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue({ id: "s1" })
    seriesUpdateMock.mockResolvedValue({})
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(seriesUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1" } }))
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "EVENT_SERIES_CORRECTED" }),
      })
    )
  })

  it("erlaubt MANAGER das Speichern einer Event-Serie", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    seriesFindUniqueMock.mockResolvedValue(null)
    seriesCreateMock.mockResolvedValue({ id: "s1" })
    auditLogCreateMock.mockResolvedValue({})
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ success: true })
  })

  it("verwendet Disziplin aus Competition wenn CP keine hat", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(cpWithoutDiscipline)
    disciplineFindUniqueMock.mockResolvedValue(discipline)
    seriesFindUniqueMock.mockResolvedValue(null)
    const result = await saveEventSeries("c1", "cp1", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(disciplineFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" } })
    )
  })

  it("liefert Fehler wenn Ringe über Maximum (WHOLE, 10 Schuss → max 100)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      ...eventCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindUniqueMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
    const fd = makeFormData({ rings: "101", teiler: "3.7" })
    const result = await saveEventSeries("c1", "cp1", null, fd)
    expect(result).toMatchObject({
      error: { rings: expect.arrayContaining([expect.stringContaining("100")]) },
    })
  })

  it("liefert Fehler wenn Ringe nicht ganzzahlig bei WHOLE-Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      ...eventCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindUniqueMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
    const fd = makeFormData({ rings: "95.5", teiler: "3.7" })
    const result = await saveEventSeries("c1", "cp1", null, fd)
    expect(result).toMatchObject({
      error: { rings: expect.arrayContaining([expect.stringContaining("ganze")]) },
    })
  })

  it("akzeptiert Dezimalringe bei DECIMAL-Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const decimalDiscipline = { ...discipline, scoringType: "DECIMAL" as const }
    competitionFindUniqueMock.mockResolvedValue({
      ...eventCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindUniqueMock.mockResolvedValue({
      ...cpWithDiscipline,
      discipline: decimalDiscipline,
    })
    seriesFindUniqueMock.mockResolvedValue(null)
    const fd = makeFormData({ rings: "104.5", teiler: "2.1" })
    const result = await saveEventSeries("c1", "cp1", null, fd)
    expect(result).not.toMatchObject({ error: { rings: expect.anything() } })
  })

  it("feste Disziplin: Ringteiler ohne Faktor (LP 0.333 → effektiv 1.0)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const lpDiscipline = {
      id: "d-lp",
      name: "Luftpistole",
      scoringType: "WHOLE" as const,
      teilerFaktor: { toNumber: () => 0.3333333 },
    }
    competitionFindUniqueMock.mockResolvedValue({
      ...eventCompetition,
      shotsPerSeries: 10,
      disciplineId: "d-lp",
    })
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      participantId: "p1",
      disciplineId: "d-lp",
      discipline: lpDiscipline,
      participant: { firstName: "Max", lastName: "Mustermann" },
    })
    await saveEventSeries("c1", "cp1", null, makeFormData({ rings: "90", teiler: "60" }))
    expect(seriesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ringteiler: 70 }) })
    )
  })
})

// ─── deleteEventSeries ────────────────────────────────────────────────────────

describe("deleteEventSeries", () => {
  const seriesRecord = {
    id: "s1",
    competitionId: "c1",
    rings: 95,
    teiler: 123.4,
    participant: { firstName: "Max", lastName: "Mustermann" },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    seriesFindUniqueMock.mockResolvedValue(seriesRecord)
    seriesDeleteMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await deleteEventSeries("s1", "c1")
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await deleteEventSeries("s1", "c1")
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn Serie nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue(null)
    const result = await deleteEventSeries("s1", "c1")
    expect(result).toEqual({ error: "Serie nicht gefunden." })
  })

  it("liefert Fehler wenn Serie zu anderer Competition gehört", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue({ ...seriesRecord, competitionId: "other" })
    const result = await deleteEventSeries("s1", "c1")
    expect(result).toEqual({ error: "Ungültige Anfrage." })
  })

  it("löscht Serie und schreibt auditLog EVENT_SERIES_DELETED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteEventSeries("s1", "c1")
    expect(result).toEqual({ success: true })
    expect(seriesDeleteMock).toHaveBeenCalledWith({ where: { id: "s1" } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "EVENT_SERIES_DELETED" }),
      })
    )
  })
})

// ─── saveSeasonSeries ─────────────────────────────────────────────────────────

describe("saveSeasonSeries", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue(seasonCompetition)
    competitionParticipantFindFirstMock.mockResolvedValue(cpWithDiscipline)
    seriesCreateMock.mockResolvedValue({ id: "s1" })
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({ rings: "95", teiler: "123.4", sessionDate: "2026-03-01" })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn Competition nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("liefert Fehler wenn Competition kein SEASON ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...seasonCompetition, type: "EVENT" })
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Nur für Saison-Wettbewerbe." })
  })

  it("liefert Fehler wenn Competition ARCHIVED ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...seasonCompetition, status: "ARCHIVED" })
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Archivierte Wettbewerbe sind gesperrt." })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindFirstMock.mockResolvedValue(null)
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." })
  })

  it("liefert Validierungsfehler bei fehlendem sessionDate", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await saveSeasonSeries(
      "c2",
      "p1",
      null,
      makeFormData({ rings: "95", teiler: "123.4", sessionDate: "" })
    )
    expect(result).toMatchObject({ error: { sessionDate: expect.any(Array) } })
    expect(seriesCreateMock).not.toHaveBeenCalled()
  })

  it("erstellt neue Saison-Serie", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(seriesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rings: 95,
          teiler: 123.4,
          competitionId: "c2",
          participantId: "p1",
        }),
      })
    )
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "SEASON_SERIES_ENTERED" }),
      })
    )
  })

  it("löst Disziplin aus formData auf wenn abweichend von CP-Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // CP hat d1, formData überschreibt mit d2
    disciplineFindUniqueMock.mockResolvedValue({ ...discipline, id: "d2" })
    const fd = makeFormData({
      rings: "95",
      teiler: "123.4",
      sessionDate: "2026-03-01",
      disciplineId: "d2",
    })
    const result = await saveSeasonSeries("c2", "p1", null, fd)
    expect(result).toEqual({ success: true })
    expect(disciplineFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d2" } })
    )
  })

  it("erlaubt MANAGER das Speichern einer Saison-Serie", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    seriesCreateMock.mockResolvedValue({ id: "s1" })
    auditLogCreateMock.mockResolvedValue({})
    const result = await saveSeasonSeries("c2", "p1", null, validFormData)
    expect(result).toEqual({ success: true })
  })

  it("liefert Fehler wenn Ringe über Maximum (WHOLE, 10 Schuss → max 100)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      ...seasonCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindFirstMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
    const fd = makeFormData({ rings: "101", teiler: "3.7", sessionDate: "2026-03-01" })
    const result = await saveSeasonSeries("c2", "p1", null, fd)
    expect(result).toMatchObject({
      error: { rings: expect.arrayContaining([expect.stringContaining("100")]) },
    })
  })

  it("liefert Fehler wenn Ringe nicht ganzzahlig bei WHOLE-Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      ...seasonCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindFirstMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
    const fd = makeFormData({ rings: "95.5", teiler: "3.7", sessionDate: "2026-03-01" })
    const result = await saveSeasonSeries("c2", "p1", null, fd)
    expect(result).toMatchObject({
      error: { rings: expect.arrayContaining([expect.stringContaining("ganze")]) },
    })
  })

  it("akzeptiert Dezimalringe bei DECIMAL-Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const decimalDiscipline = { ...discipline, scoringType: "DECIMAL" as const }
    competitionFindUniqueMock.mockResolvedValue({
      ...seasonCompetition,
      scoringMode: "RINGTEILER",
      shotsPerSeries: 10,
    })
    competitionParticipantFindFirstMock.mockResolvedValue({
      ...cpWithDiscipline,
      discipline: decimalDiscipline,
    })
    seriesCreateMock.mockResolvedValue({ id: "s1" })
    const fd = makeFormData({ rings: "104.5", teiler: "2.1", sessionDate: "2026-03-01" })
    const result = await saveSeasonSeries("c2", "p1", null, fd)
    expect(result).not.toMatchObject({ error: { rings: expect.anything() } })
  })

  it("feste Saison-Disziplin: Ringteiler ohne Faktor", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const lpDiscipline = {
      id: "d-lp",
      name: "Luftpistole",
      scoringType: "WHOLE" as const,
      teilerFaktor: { toNumber: () => 0.3333333 },
    }
    competitionFindUniqueMock.mockResolvedValue({
      ...seasonCompetition,
      shotsPerSeries: 10,
      disciplineId: "d-lp",
    })
    competitionParticipantFindFirstMock.mockResolvedValue({
      id: "cp1",
      disciplineId: "d-lp",
      discipline: lpDiscipline,
      participant: { firstName: "Max", lastName: "Mustermann" },
    })
    seriesFindUniqueMock.mockResolvedValue(null)
    await saveSeasonSeries(
      "c2",
      "p1",
      null,
      makeFormData({ rings: "90", teiler: "60", sessionDate: "2026-02-01" })
    )
    expect(seriesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ringteiler: 70 }) })
    )
  })
})

// ─── updateSeasonSeries ───────────────────────────────────────────────────────

describe("updateSeasonSeries", () => {
  const existingSeriesRecord = {
    id: "s1",
    competitionId: "c2",
    participantId: "p1",
    participant: { firstName: "Max", lastName: "Mustermann" },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue(seasonCompetition)
    seriesFindUniqueMock.mockResolvedValue(existingSeriesRecord)
    competitionParticipantFindFirstMock.mockResolvedValue(cpWithDiscipline)
    seriesUpdateMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({ rings: "96", teiler: "120.0", sessionDate: "2026-03-01" })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn Serie nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue(null)
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Serie nicht gefunden." })
  })

  it("liefert Fehler wenn Serie zu anderer Competition gehört", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue({ ...existingSeriesRecord, competitionId: "other" })
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Ungültige Anfrage." })
  })

  it("liefert Fehler wenn CP nicht in Wettbewerb eingeschrieben", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindFirstMock.mockResolvedValue(null)
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." })
  })

  it("aktualisiert Serie und schreibt auditLog SEASON_SERIES_CORRECTED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(seriesUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1" } }))
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "SEASON_SERIES_CORRECTED" }),
      })
    )
  })

  it("liefert Validierungsfehler bei fehlendem sessionDate", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateSeasonSeries(
      "c2",
      "s1",
      null,
      makeFormData({ rings: "96", teiler: "120.0", sessionDate: "" })
    )
    expect(result).toMatchObject({ error: { sessionDate: expect.any(Array) } })
    expect(seriesUpdateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Competition kein SEASON ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...seasonCompetition, type: "EVENT" })
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Nur für Saison-Wettbewerbe." })
  })

  it("liefert Fehler wenn Competition ARCHIVED ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({ ...seasonCompetition, status: "ARCHIVED" })
    const result = await updateSeasonSeries("c2", "s1", null, validFormData)
    expect(result).toEqual({ error: "Archivierte Wettbewerbe sind gesperrt." })
  })
})

// ─── deleteSeasonSeries ───────────────────────────────────────────────────────

describe("deleteSeasonSeries", () => {
  const seriesRecord = {
    id: "s2",
    competitionId: "c2",
    rings: 90,
    teiler: 150.0,
    sessionDate: new Date("2026-03-01"),
    participant: { firstName: "Max", lastName: "Mustermann" },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    seriesFindUniqueMock.mockResolvedValue(seriesRecord)
    seriesDeleteMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await deleteSeasonSeries("s2", "c2")
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await deleteSeasonSeries("s2", "c2")
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn Serie nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue(null)
    const result = await deleteSeasonSeries("s2", "c2")
    expect(result).toEqual({ error: "Serie nicht gefunden." })
  })

  it("liefert Fehler wenn Serie zu anderer Competition gehört", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    seriesFindUniqueMock.mockResolvedValue({ ...seriesRecord, competitionId: "other" })
    const result = await deleteSeasonSeries("s2", "c2")
    expect(result).toEqual({ error: "Ungültige Anfrage." })
  })

  it("löscht Saison-Serie und schreibt auditLog SEASON_SERIES_DELETED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteSeasonSeries("s2", "c2")
    expect(result).toEqual({ success: true })
    expect(seriesDeleteMock).toHaveBeenCalledWith({ where: { id: "s2" } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "SEASON_SERIES_DELETED" }),
      })
    )
  })
})
