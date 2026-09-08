import { describe, expect, it } from "vitest"

import type { GoalWithAssignments } from "@/lib/goals/types"
import type { SessionWithDiscipline } from "@/lib/sessions/actions/types"

import { selectDashboardData } from "./selectDashboardData"

const NOW = new Date("2026-09-08T12:00:00Z")

function session(isoDate: string): SessionWithDiscipline {
  return {
    id: `s-${isoDate}`,
    date: new Date(isoDate),
  } as unknown as SessionWithDiscipline
}

function goal(id: string, from: string, to: string): GoalWithAssignments {
  return {
    id,
    title: `Ziel ${id}`,
    description: null,
    type: "RESULT",
    dateFrom: new Date(from),
    dateTo: new Date(to),
    sessionCount: 0,
    sessionIds: [],
  } as unknown as GoalWithAssignments
}

describe("selectDashboardData — letzte Einheiten", () => {
  it("nimmt die fuenf neuesten und sortiert absteigend", () => {
    const sessions = [
      session("2026-09-01T10:00:00Z"),
      session("2026-09-07T10:00:00Z"),
      session("2026-08-20T10:00:00Z"),
      session("2026-09-05T10:00:00Z"),
      session("2026-09-06T10:00:00Z"),
      session("2026-09-03T10:00:00Z"),
      session("2026-09-04T10:00:00Z"),
    ]

    const result = selectDashboardData(sessions, [], NOW)

    expect(result.recentSessions.map((s) => s.id)).toEqual([
      "s-2026-09-07T10:00:00Z",
      "s-2026-09-06T10:00:00Z",
      "s-2026-09-05T10:00:00Z",
      "s-2026-09-04T10:00:00Z",
      "s-2026-09-03T10:00:00Z",
    ])
  })

  it("kommt mit weniger als fuenf Einheiten aus", () => {
    const result = selectDashboardData([session("2026-09-07T10:00:00Z")], [], NOW)
    expect(result.recentSessions).toHaveLength(1)
  })

  it("laesst die Liste leer, wenn nichts erfasst ist", () => {
    const result = selectDashboardData([], [], NOW)
    expect(result.recentSessions).toEqual([])
    expect(result.sessionsTotal).toBe(0)
    expect(result.sessionsLast30Days).toBe(0)
  })
})

describe("selectDashboardData — Kennzahlen", () => {
  it("zaehlt nur Einheiten innerhalb der letzten 30 Tage", () => {
    const sessions = [
      session("2026-09-08T11:00:00Z"), // heute
      session("2026-08-10T12:00:00Z"), // genau 29 Tage her
      session("2026-08-09T12:00:00Z"), // genau 30 Tage her → noch drin
      session("2026-08-08T11:59:00Z"), // aelter als 30 Tage → raus
      session("2026-01-01T12:00:00Z"),
    ]

    const result = selectDashboardData(sessions, [], NOW)

    expect(result.sessionsTotal).toBe(5)
    expect(result.sessionsLast30Days).toBe(3)
  })

  it("zaehlt eine Einheit in der Zukunft nicht als vergangene 30 Tage", () => {
    const result = selectDashboardData([session("2026-09-20T12:00:00Z")], [], NOW)
    expect(result.sessionsTotal).toBe(1)
    expect(result.sessionsLast30Days).toBe(0)
  })
})

describe("selectDashboardData — aktive Ziele", () => {
  it("nimmt nur Ziele, deren Zeitraum jetzt laeuft (Grenzen inklusiv)", () => {
    const goals = [
      goal("laufend", "2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z"),
      goal("beginnt-heute", "2026-09-08T12:00:00Z", "2026-10-01T00:00:00Z"),
      goal("endet-heute", "2026-08-01T00:00:00Z", "2026-09-08T12:00:00Z"),
      goal("vorbei", "2026-07-01T00:00:00Z", "2026-07-31T00:00:00Z"),
      goal("kuenftig", "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z"),
    ]

    const result = selectDashboardData([], goals, NOW)

    expect(result.activeGoals.map((g) => g.id)).toEqual(["endet-heute", "laufend", "beginnt-heute"])
  })

  it("sortiert nach naechstem Ende und zeigt maximal drei", () => {
    const goals = [
      goal("d", "2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      goal("a", "2026-09-01T00:00:00Z", "2026-09-10T00:00:00Z"),
      goal("c", "2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z"),
      goal("b", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"),
    ]

    const result = selectDashboardData([], goals, NOW)

    expect(result.activeGoals.map((g) => g.id)).toEqual(["a", "b", "c"])
  })
})
