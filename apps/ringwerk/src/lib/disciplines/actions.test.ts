import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  findUniqueMock,
  createMock,
  updateMock,
  deleteMock,
  competitionCountMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  competitionCountMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    discipline: {
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock,
    },
    competition: { count: competitionCountMock },
    auditLog: { create: auditLogCreateMock },
  },
}))

import {
  createDiscipline,
  deleteDiscipline,
  setDisciplineArchived,
  updateDiscipline,
} from "@/lib/disciplines/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createDiscipline ────────────────────────────────────────────────────────

describe("createDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createMock.mockResolvedValue({ id: "d1" })
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("erlaubt MANAGER das Erstellen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    createMock.mockResolvedValue({ id: "d1" })
    auditLogCreateMock.mockResolvedValue({})
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ success: true })
  })

  it("liefert Validierungsfehler bei leerem Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toMatchObject({ error: { name: expect.any(Array) } })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei ungültiger Wertungsart", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "INVALID", teilerFaktor: "1.0" })
    )
    expect(result).toMatchObject({ error: { scoringType: expect.any(Array) } })
  })

  it("liefert Validierungsfehler bei ungültigem Teiler-Faktor", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "0" })
    )
    expect(result).toMatchObject({ error: { teilerFaktor: expect.any(Array) } })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("legt Disziplin an und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "Luftpistole", scoringType: "WHOLE", teilerFaktor: "0.333" })
    )
    expect(result).toEqual({ success: true })
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Luftpistole", scoringType: "WHOLE", teilerFaktor: 0.333 },
      select: { id: true },
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateDiscipline ────────────────────────────────────────────────────────

describe("updateDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    updateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Disziplin nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue(null)
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
    )
    expect(result).toEqual({ error: "Disziplin nicht gefunden." })
  })

  it("blockiert Wertungsartwechsel wenn Ligen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    competitionCountMock.mockResolvedValue(2)

    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "DECIMAL", teilerFaktor: "1.0" })
    )

    expect(result).toMatchObject({ error: expect.stringContaining("Wertungsart") })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("erlaubt Wertungsartwechsel ohne Ligen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    competitionCountMock.mockResolvedValue(0)

    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "DECIMAL", teilerFaktor: "1.8" })
    )

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalled()
  })
})

// ─── deleteDiscipline ────────────────────────────────────────────────────────

describe("deleteDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    deleteMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await deleteDiscipline("d1")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole" })
    expect(await deleteDiscipline("d1")).toEqual({ error: "Keine Berechtigung" })
  })

  it("verweigert MANAGER das Löschen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await deleteDiscipline("d1")
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("blockiert Löschen wenn Ligen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole" })
    competitionCountMock.mockResolvedValue(1)

    const result = await deleteDiscipline("d1")

    expect(result).toMatchObject({ error: expect.stringContaining("Wettbewerben") })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("löscht Disziplin ohne Ligen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole" })
    competitionCountMock.mockResolvedValue(0)

    const result = await deleteDiscipline("d1")

    expect(result).toEqual({ success: true })
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "d1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── setDisciplineArchived ───────────────────────────────────────────────────

describe("setDisciplineArchived", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    updateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await setDisciplineArchived("d1", true)).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole", isArchived: false })
    expect(await setDisciplineArchived("d1", true)).toEqual({ error: "Keine Berechtigung" })
  })

  it("erlaubt MANAGER das Archivieren", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "LP", isArchived: false })
    updateMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
    const result = await setDisciplineArchived("d1", true)
    expect(result).toEqual({ success: true })
  })

  it("ist idempotent — kein Update wenn Status bereits korrekt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole", isArchived: true })

    const result = await setDisciplineArchived("d1", true)

    expect(result).toEqual({ success: true })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("archiviert eine aktive Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", name: "Luftpistole", isArchived: false })

    const result = await setDisciplineArchived("d1", true)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "d1" }, data: { isArchived: true } })
  })
})
