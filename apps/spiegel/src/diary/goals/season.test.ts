import { describe, expect, it } from "vitest"

import { goalPhase, nextSeason, seasonOf } from "./season"

describe("seasonOf", () => {
  it("der 31. August gehört zur alten Saison, der 1. September zur neuen", () => {
    expect(seasonOf("2026-08-31")).toEqual({
      from: "2025-09-01",
      to: "2026-08-31",
      label: "Saison 25/26",
    })
    expect(seasonOf("2026-09-01")).toEqual({
      from: "2026-09-01",
      to: "2027-08-31",
      label: "Saison 26/27",
    })
  })

  it("Januar gehört zur Saison des Vorjahrs, auch über ein Schaltjahr", () => {
    expect(seasonOf("2028-02-29").from).toBe("2027-09-01")
    expect(seasonOf("2000-01-15").label).toBe("Saison 99/00")
  })

  it("die nächste Saison folgt lückenlos", () => {
    expect(nextSeason("2026-10-28")).toEqual({
      from: "2027-09-01",
      to: "2028-08-31",
      label: "Saison 27/28",
    })
  })
})

describe("goalPhase", () => {
  const goal = { from: "2026-09-01", to: "2027-08-31" }

  it("vor dem Beginn, am ersten Tag, am letzten Tag, danach", () => {
    expect(goalPhase(goal, "2026-08-31")).toEqual({ phase: "upcoming" })
    expect(goalPhase(goal, "2026-09-01")).toEqual({ phase: "running", months: 12 })
    expect(goalPhase(goal, "2027-08-31")).toEqual({ phase: "running", months: 1 })
    expect(goalPhase(goal, "2027-09-01")).toEqual({ phase: "past" })
  })

  it("Monate bis zum Ende aufgerundet", () => {
    expect(goalPhase(goal, "2026-10-28")).toEqual({ phase: "running", months: 11 })
    expect(goalPhase(goal, "2027-07-15")).toEqual({ phase: "running", months: 2 })
  })
})
