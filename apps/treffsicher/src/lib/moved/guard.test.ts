import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAuthSessionMock, disciplineFindUniqueMock } = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))

/** Disziplinen nach `where.id` wie Prisma: eine der Anlage, eine eigene, sonst keine */
const DISCIPLINES: Record<string, { isSystem: boolean }> = {
  "system-1": { isSystem: true },
  "own-1": { isSystem: false },
}

vi.mock("@/lib/db", () => ({
  db: { discipline: { findUnique: disciplineFindUniqueMock } },
}))

import { refuseDisciplineIfMoved, refuseIfMoved } from "./guard"
import { MOVED_TEXTS } from "./texts"

const REFUSAL = { error: MOVED_TEXTS.refusal }

function signIn(movedToSpiegel: boolean, role: "USER" | "ADMIN" = "USER") {
  getAuthSessionMock.mockResolvedValue({ user: { id: "user-1", role, movedToSpiegel } })
}

describe("refuseIfMoved", () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset()
  })

  it("ohne Sitzung: keine Ablehnung, die Action meldet selbst", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await refuseIfMoved()).toBeNull()
  })

  it("nicht umgezogen: keine Ablehnung", async () => {
    signIn(false)
    expect(await refuseIfMoved()).toBeNull()
  })

  it("umgezogen: Ablehnung mit dem Satz für den Server", async () => {
    signIn(true)
    expect(await refuseIfMoved()).toEqual(REFUSAL)
  })
})

describe("refuseDisciplineIfMoved", () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset()
    disciplineFindUniqueMock.mockReset()
    disciplineFindUniqueMock.mockImplementation(
      async ({ where }: { where: { id: string } }) => DISCIPLINES[where.id] ?? null
    )
  })

  it("nicht umgezogen: keine Ablehnung, ohne Abfrage", async () => {
    signIn(false)
    expect(await refuseDisciplineIfMoved({ id: "own-1" })).toBeNull()
    expect(await refuseDisciplineIfMoved({ isSystem: false })).toBeNull()
    expect(disciplineFindUniqueMock).not.toHaveBeenCalled()
  })

  it("ohne Sitzung: keine Ablehnung", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await refuseDisciplineIfMoved({ id: "own-1" })).toBeNull()
  })

  it("umgezogenes Mitglied: abgelehnt, auch an einer Disziplin der Anlage", async () => {
    signIn(true)
    expect(await refuseDisciplineIfMoved({ isSystem: true })).toEqual(REFUSAL)
    expect(await refuseDisciplineIfMoved({ isSystem: false })).toEqual(REFUSAL)
    expect(await refuseDisciplineIfMoved({ id: "system-1" })).toEqual(REFUSAL)
    expect(await refuseDisciplineIfMoved({ id: "own-1" })).toEqual(REFUSAL)
  })

  it("umgezogener Admin: Disziplin der Anlage geht, eigene abgelehnt", async () => {
    signIn(true, "ADMIN")
    expect(await refuseDisciplineIfMoved({ isSystem: true })).toBeNull()
    expect(await refuseDisciplineIfMoved({ id: "system-1" })).toBeNull()
    expect(await refuseDisciplineIfMoved({ isSystem: false })).toEqual(REFUSAL)
    expect(await refuseDisciplineIfMoved({ id: "own-1" })).toEqual(REFUSAL)
  })

  it("fehlende Disziplin: keine Ablehnung, die Action meldet „nicht gefunden“", async () => {
    signIn(true)
    expect(await refuseDisciplineIfMoved({ id: "missing" })).toBeNull()
    expect(disciplineFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "missing" },
      select: { isSystem: true },
    })
  })
})
