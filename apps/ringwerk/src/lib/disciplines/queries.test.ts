import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, competitionCount, enrolmentCount, seriesCount } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  competitionCount: vi.fn(),
  enrolmentCount: vi.fn(),
  seriesCount: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    discipline: { findUnique },
    competition: { count: competitionCount },
    competitionParticipant: { count: enrolmentCount },
    series: { count: seriesCount },
  },
}))

import { getDisciplineFactorLock } from "./queries"

describe("getDisciplineFactorLock", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    findUnique.mockResolvedValue({ isSystem: false })
    competitionCount.mockResolvedValue(0)
    enrolmentCount.mockResolvedValue(0)
    seriesCount.mockResolvedValue(0)
  })

  it("Standarddisziplin", async () => {
    findUnique.mockResolvedValue({ isSystem: true })
    expect(await getDisciplineFactorLock("d1")).toBe("system")
  })

  it.each([
    ["einen Wettbewerb", competitionCount],
    ["eine Einschreibung", enrolmentCount],
    ["eine Serie", seriesCount],
  ])("genutzt über %s", async (_, count) => {
    count.mockResolvedValue(2)
    expect(await getDisciplineFactorLock("d1")).toBe("used")
    expect(count).toHaveBeenCalledWith({ where: { disciplineId: "d1" } })
  })

  it("ungenutzt", async () => {
    expect(await getDisciplineFactorLock("d1")).toBeNull()
  })
})
