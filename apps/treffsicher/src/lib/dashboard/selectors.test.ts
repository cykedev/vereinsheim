import { describe, expect, it } from "vitest"

import type { GoalWithAssignments } from "@/lib/goals/types"

import { recentWindowStart, selectActiveGoals } from "./selectors"

const NOW = new Date("2026-09-08T12:00:00Z")

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

describe("recentWindowStart", () => {
  it("liegt genau 30 Tage vor dem Bezugszeitpunkt", () => {
    expect(recentWindowStart(NOW).toISOString()).toBe("2026-08-09T12:00:00.000Z")
  })

  it("laesst eine Einheit von genau vor 30 Tagen noch ins Fenster", () => {
    const exactly30 = new Date("2026-08-09T12:00:00Z")
    expect(exactly30.getTime()).toBeGreaterThanOrEqual(recentWindowStart(NOW).getTime())
  })

  it("schliesst eine Einheit knapp ausserhalb aus", () => {
    const justOutside = new Date("2026-08-09T11:59:00Z")
    expect(justOutside.getTime()).toBeLessThan(recentWindowStart(NOW).getTime())
  })

  it("rechnet ueber einen Monatswechsel hinweg korrekt", () => {
    expect(recentWindowStart(new Date("2026-03-05T08:00:00Z")).toISOString()).toBe(
      "2026-02-03T08:00:00.000Z"
    )
  })
})

describe("selectActiveGoals", () => {
  it("nimmt nur Ziele, deren Zeitraum jetzt laeuft (Grenzen inklusiv)", () => {
    const goals = [
      goal("laufend", "2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z"),
      goal("beginnt-heute", "2026-09-08T12:00:00Z", "2026-10-01T00:00:00Z"),
      goal("endet-heute", "2026-08-01T00:00:00Z", "2026-09-08T12:00:00Z"),
      goal("vorbei", "2026-07-01T00:00:00Z", "2026-07-31T00:00:00Z"),
      goal("kuenftig", "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z"),
    ]

    expect(selectActiveGoals(goals, NOW).map((g) => g.id)).toEqual([
      "endet-heute",
      "laufend",
      "beginnt-heute",
    ])
  })

  it("sortiert nach naechstem Ende und zeigt maximal drei", () => {
    const goals = [
      goal("d", "2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      goal("a", "2026-09-01T00:00:00Z", "2026-09-10T00:00:00Z"),
      goal("c", "2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z"),
      goal("b", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"),
    ]

    expect(selectActiveGoals(goals, NOW).map((g) => g.id)).toEqual(["a", "b", "c"])
  })

  it("liefert eine leere Liste, wenn nichts laeuft", () => {
    expect(selectActiveGoals([], NOW)).toEqual([])
    expect(
      selectActiveGoals([goal("vorbei", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")], NOW)
    ).toEqual([])
  })
})
