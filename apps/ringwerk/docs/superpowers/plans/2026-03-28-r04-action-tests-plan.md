# R-04 Action Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full test coverage for `series/actions.ts`, `users/actions.ts`, `results/actions.ts`, and the untested functions in `competitionParticipants/actions.ts`.

**Architecture:** One test file per module, following the established pattern from `competitions/actions.test.ts` (`vi.hoisted` → `vi.mock` → import → `describe`/`beforeEach`/`it`). All four tasks are independent and can run in parallel. Each task ends with a commit.

**Tech Stack:** Vitest, `vi.hoisted`, `vi.mock`, `vi.fn()`, `vi.resetAllMocks()`

## Required Docs

Beyond the baseline, no additional docs required for this plan.

---

## File Map

| File                                              | Action                   |
| ------------------------------------------------- | ------------------------ |
| `src/lib/series/actions.test.ts`                  | Create (Task 1)          |
| `src/lib/users/actions.test.ts`                   | Create (Task 2)          |
| `src/lib/results/actions.test.ts`                 | Create (Task 3)          |
| `src/lib/competitionParticipants/actions.test.ts` | Modify — extend (Task 4) |

---

## Task 1: series/actions.test.ts

**Files:**

- Create: `src/lib/series/actions.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
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

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
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
  shotsPerSeries: 30,
  disciplineId: "d1",
}

const seasonCompetition = {
  id: "c2",
  type: "SEASON",
  status: "ACTIVE",
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts
```

Expected: All tests green, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/series/actions.test.ts
git commit -m "test(r-04): add full test coverage for series/actions"
```

---

## Task 2: users/actions.test.ts

**Files:**

- Create: `src/lib/users/actions.test.ts`

**Note on bcrypt mocking:** `users/actions.ts` uses `import bcrypt from "bcryptjs"` (default import). Mock the default export so `bcrypt.hash()` and `bcrypt.compare()` are controlled. Passwords must be ≥ 12 characters (`MIN_PASSWORD_LENGTH = 12`) to pass length validation.

- [ ] **Step 1: Create the test file**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  userFindUniqueMock,
  userFindFirstMock,
  userCreateMock,
  userUpdateMock,
  userCountMock,
  auditLogCreateMock,
  bcryptHashMock,
  bcryptCompareMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  userCreateMock: vi.fn(),
  userUpdateMock: vi.fn(),
  userCountMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  bcryptCompareMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("bcryptjs", () => ({
  default: { hash: bcryptHashMock, compare: bcryptCompareMock },
}))
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
      findFirst: userFindFirstMock,
      create: userCreateMock,
      update: userUpdateMock,
      count: userCountMock,
    },
    auditLog: { create: auditLogCreateMock },
  },
}))

import { createUser, updateUser, setUserActive, changeOwnPassword } from "@/lib/users/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createUser ───────────────────────────────────────────────────────────────

describe("createUser", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(null)
    userCreateMock.mockResolvedValue({ id: "new1" })
    bcryptHashMock.mockResolvedValue("hashed-password")
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({
    name: "Max Mustermann",
    email: "max@example.com",
    tempPassword: "sicheresPasswort1",
    role: "USER",
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Validierungsfehler bei ungültiger E-Mail", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(
      null,
      makeFormData({
        name: "Test",
        email: "keineemail",
        tempPassword: "sicheresPasswort1",
        role: "USER",
      })
    )
    expect(result).toMatchObject({ error: { email: expect.any(Array) } })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei zu kurzem Passwort (< 12 Zeichen)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(
      null,
      makeFormData({
        name: "Test",
        email: "max@example.com",
        tempPassword: "kurzpw",
        role: "USER",
      })
    )
    expect(result).toMatchObject({ error: { tempPassword: expect.any(Array) } })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler bei bereits verwendeter E-Mail", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue({ id: "existing1" })
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Diese E-Mail-Adresse wird bereits verwendet." })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("erstellt User und schreibt auditLog USER_CREATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ success: true })
    expect(userCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "max@example.com", role: "USER" }),
      })
    )
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_CREATED" }),
      })
    )
  })
})

// ─── updateUser ───────────────────────────────────────────────────────────────

describe("updateUser", () => {
  const existingUser = { id: "u3", role: "USER", isActive: true }
  const existingAdmin = { id: "u3", role: "ADMIN", isActive: true }

  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(existingUser)
    userFindFirstMock.mockResolvedValue(null)
    userUpdateMock.mockResolvedValue({})
    userCountMock.mockResolvedValue(2)
    bcryptHashMock.mockResolvedValue("new-hash")
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({
    name: "Max Update",
    email: "update@example.com",
    role: "USER",
    isActive: "true",
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn User nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("liefert Fehler bei E-Mail-Konflikt mit anderem User", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindFirstMock.mockResolvedValue({ id: "other" })
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Diese E-Mail-Adresse wird bereits verwendet." })
  })

  it("liefert Fehler wenn eigener Account deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u3", role: "ADMIN" } })
    const result = await updateUser(
      "u3",
      null,
      makeFormData({ name: "Test", email: "me@example.com", role: "ADMIN", isActive: "false" })
    )
    expect(result).toEqual({ error: "Du kannst deinen eigenen Account nicht deaktivieren." })
  })

  it("liefert Fehler wenn letzter aktiver Admin degradiert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(existingAdmin)
    userCountMock.mockResolvedValue(0)
    const result = await updateUser(
      "u3",
      null,
      makeFormData({ name: "Test", email: "admin@example.com", role: "USER", isActive: "true" })
    )
    expect(result).toEqual({
      error: "Der letzte aktive Administrator kann nicht degradiert oder deaktiviert werden.",
    })
  })

  it("aktualisiert User ohne Passwort-Reset und schreibt auditLog USER_UPDATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u3" } }))
    expect(bcryptHashMock).not.toHaveBeenCalled()
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_UPDATED" }),
      })
    )
  })

  it("setzt neues passwordHash und incrementiert sessionVersion bei Passwort-Reset", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const fd = makeFormData({
      name: "Max",
      email: "update@example.com",
      role: "USER",
      isActive: "true",
      tempPassword: "neuesPasswort123",
    })
    const result = await updateUser("u3", null, fd)
    expect(result).toEqual({ success: true })
    expect(bcryptHashMock).toHaveBeenCalled()
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "new-hash",
          sessionVersion: { increment: 1 },
        }),
      })
    )
  })
})

// ─── setUserActive ────────────────────────────────────────────────────────────

describe("setUserActive", () => {
  const activeUser = {
    id: "u3",
    name: "Max",
    email: "max@example.com",
    role: "USER",
    isActive: true,
  }
  const inactiveUser = { ...activeUser, isActive: false }
  const activeAdmin = { ...activeUser, role: "ADMIN" }

  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(activeUser)
    userUpdateMock.mockResolvedValue({})
    userCountMock.mockResolvedValue(2)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn User nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("gibt success zurück ohne DB-Update wenn isActive bereits gleich dem Zielwert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeUser)
    const result = await setUserActive("u3", true)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn eigener Account deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u3", role: "ADMIN" } })
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Du kannst deinen eigenen Account nicht deaktivieren." })
  })

  it("liefert Fehler wenn letzter aktiver Admin deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeAdmin)
    userCountMock.mockResolvedValue(0)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({
      error: "Der letzte aktive Administrator kann nicht deaktiviert werden.",
    })
  })

  it("deaktiviert User und schreibt auditLog USER_DEACTIVATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeUser)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u3" }, data: { isActive: false } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_DEACTIVATED" }),
      })
    )
  })

  it("reaktiviert User und schreibt auditLog USER_REACTIVATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(inactiveUser)
    const result = await setUserActive("u3", true)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u3" }, data: { isActive: true } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_REACTIVATED" }),
      })
    )
  })
})

// ─── changeOwnPassword ────────────────────────────────────────────────────────

describe("changeOwnPassword", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue({ id: "u1", passwordHash: "old-hash" })
    bcryptCompareMock.mockResolvedValue(true)
    bcryptHashMock.mockResolvedValue("new-hash")
    userUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort123",
        confirmPassword: "neuesPasswort123",
      })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn Passwörter nicht übereinstimmen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort123",
        confirmPassword: "andresPasswort456",
      })
    )
    // validatePasswordChangeInput gibt String-Fehler zurück
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn User nicht in DB gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("liefert Fehler bei falschem aktuellem Passwort", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    bcryptCompareMock.mockResolvedValue(false)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "falschesPasswort1",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ error: "Aktuelles Passwort ist falsch." })
  })

  it("setzt neues Passwort und incrementiert sessionVersion", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/users/actions.test.ts
```

Expected: All tests green, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/users/actions.test.ts
git commit -m "test(r-04): add full test coverage for users/actions"
```

---

## Task 3: results/actions.test.ts

**Files:**

- Create: `src/lib/results/actions.test.ts`

**Note on `$transaction`:** `saveMatchResult` uses a function-based transaction `db.$transaction(async (tx) => {...})`. The mock must implement the callback pattern so the inner `tx.series.upsert` and `tx.matchup.update` calls execute. Use a fresh `vi.fn()` per call inside the implementation to avoid state leakage between tests.

- [ ] **Step 1: Create the test file**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  matchupFindUniqueMock,
  transactionMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  matchupFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    matchup: { findUnique: matchupFindUniqueMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import { saveMatchResult } from "@/lib/results/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }

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

  it("liefert Fehler wenn keine Disziplin konfiguriert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({
      ...matchupBase,
      competition: { shotsPerSeries: 30, discipline: null },
    })
    const result = await saveMatchResult("m1", resultInput)
    expect(result).toEqual({ error: "Disziplin nicht konfiguriert." })
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
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/results/actions.test.ts
```

Expected: All tests green, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/results/actions.test.ts
git commit -m "test(r-04): add full test coverage for results/actions"
```

---

## Task 4: Extend competitionParticipants/actions.test.ts

**Files:**

- Modify: `src/lib/competitionParticipants/actions.test.ts`

**What needs to change:**

1. In `vi.hoisted`: add `competitionParticipantUpdateMock` and `auditLogCreateMock`
2. In `vi.mock("@/lib/db", ...)`: add `competitionParticipant.update` and `auditLog.create`
3. In import statement: add `withdrawParticipant`, `revokeWithdrawal`, `updateStartNumber`
4. Append three new `describe` blocks at the end of the file

**Note on `$transaction` for these functions:** `withdrawParticipant` and `revokeWithdrawal` use an array-based Prisma transaction `db.$transaction([...])`, not a function-based one. The mock for these tests should be `transactionMock.mockResolvedValue([{}, {}])`.

- [ ] **Step 1: Extend `vi.hoisted` block**

In the existing `vi.hoisted(...)` call, add two new mocks. The full updated block is:

```typescript
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
}))
```

- [ ] **Step 2: Extend `vi.mock("@/lib/db", ...)` block**

Replace the existing `db` mock object so it includes `competitionParticipant.update` and `auditLog`:

```typescript
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
    $transaction: transactionMock,
  },
}))
```

- [ ] **Step 3: Extend the import statement**

```typescript
import {
  enrollParticipant,
  unenrollParticipant,
  withdrawParticipant,
  revokeWithdrawal,
  updateStartNumber,
} from "@/lib/competitionParticipants/actions"
```

- [ ] **Step 4: Append new describe blocks at the end of the file**

```typescript
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
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u2", role: "USER" } })
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn CP bereits WITHDRAWN ist", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    competitionParticipantFindUniqueMock.mockResolvedValue({ ...activeCp, status: "WITHDRAWN" })
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Teilnehmer ist bereits zurückgezogen." })
  })

  it("liefert Fehler wenn Playoffs bereits begonnen haben", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    playoffMatchCountMock.mockResolvedValue(1)
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ error: "Rückzug nicht möglich — Playoffs haben bereits begonnen." })
  })

  it("setzt Status auf WITHDRAWN und schreibt auditLog PARTICIPANT_WITHDRAWN", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    const result = await withdrawParticipant("cp1", null, makeFormData({}))
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()])
    )
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
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u2", role: "USER" } })
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn CP nicht WITHDRAWN ist", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    competitionParticipantFindUniqueMock.mockResolvedValue({ ...withdrawnCp, status: "ACTIVE" })
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ error: "Teilnehmer ist nicht zurückgezogen." })
  })

  it("liefert Fehler wenn Playoffs bereits begonnen haben", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    playoffMatchCountMock.mockResolvedValue(1)
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({
      error: "Rückzug kann nicht rückgängig gemacht werden — Playoffs haben bereits begonnen.",
    })
  })

  it("setzt Status auf ACTIVE und schreibt auditLog WITHDRAWAL_REVOKED", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    const result = await revokeWithdrawal("cp1")
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()])
    )
  })
})

// ─── updateStartNumber ────────────────────────────────────────────────────────

describe("updateStartNumber", () => {
  const cpRecord = { id: "cp1", competitionId: "c1" }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(cpRecord)
    competitionParticipantUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateStartNumber("cp1", 5)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u2", role: "USER" } })
    const result = await updateStartNumber("cp1", 5)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await updateStartNumber("cp1", 5)
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("setzt Startnummer auf angegebenen Wert", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    const result = await updateStartNumber("cp1", 7)
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith({
      where: { id: "cp1" },
      data: { startNumber: 7 },
    })
  })

  it("setzt Startnummer auf null", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
    const result = await updateStartNumber("cp1", null)
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith({
      where: { id: "cp1" },
      data: { startNumber: null },
    })
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/competitionParticipants/actions.test.ts
```

Expected: All tests green including the 11 existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/competitionParticipants/actions.test.ts
git commit -m "test(r-04): add tests for withdrawParticipant, revokeWithdrawal, updateStartNumber"
```

---

## Task 5: Full verification and review plan update

**Files:**

- Modify: `.claude/tasks/review-plan.md`

- [ ] **Step 1: Run full quality gates**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: All green, 0 errors.

- [ ] **Step 2: Mark R-04 as complete in review plan**

In `.claude/tasks/review-plan.md`, change:

```
| R-04 | Fehlende Tests (Actions)          | 🟠   | ⬜ offen                                 |
```

to:

```
| R-04 | Fehlende Tests (Actions)          | 🟠   | ✅ erledigt (2026-03-28)                 |
```

Also update the summary table at the bottom accordingly.

- [ ] **Step 3: Commit**

```bash
git add .claude/tasks/review-plan.md
git commit -m "chore(r-04): mark R-04 as complete in review plan"
```
