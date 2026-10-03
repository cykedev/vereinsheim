import { describe, expect, it } from "vitest"
import { scheduleDialogText, scheduleRegenerationBlocker } from "./regeneration"

const NONE = { completed: 0, walkover: 0, series: 0, playoffs: 0 }

describe("scheduleRegenerationBlocker", () => {
  it("allows regeneration while nothing has been recorded", () => {
    expect(scheduleRegenerationBlocker(NONE)).toBeNull()
  })

  it("counts completed and walkover matchups as decided", () => {
    expect(scheduleRegenerationBlocker({ ...NONE, completed: 2, walkover: 1 })).toContain(
      "3 Paarung(en) bereits entschieden"
    )
  })

  it("blocks on a walkover alone", () => {
    expect(scheduleRegenerationBlocker({ ...NONE, walkover: 1 })).not.toBeNull()
  })

  it("blocks on series at an open matchup (a half-played best-of encounter)", () => {
    expect(scheduleRegenerationBlocker({ ...NONE, series: 1 })).toContain("Ergebnisse erfasst")
  })

  it("names running playoffs first", () => {
    expect(
      scheduleRegenerationBlocker({ completed: 4, walkover: 0, series: 8, playoffs: 2 })
    ).toContain("Playoffs")
  })
})

describe("scheduleDialogText", () => {
  it("describes a new best-of schedule as a single round, not as a double round-robin", () => {
    const t = scheduleDialogText({ hasSchedule: false, leagueFormat: "BEST_OF_SINGLE" })
    expect(t.title).toBe("Spielplan generieren?")
    expect(t.confirmLabel).toBe("Generieren")
    expect(t.description).toContain("Jeder gegen jeden")
    expect(t.description).not.toContain("Doppelrunde")
  })

  it("describes a new double round-robin schedule with both legs", () => {
    const t = scheduleDialogText({ hasSchedule: false, leagueFormat: "DOUBLE_ROUND_ROBIN" })
    expect(t.description).toContain("Hin- und Rückrunde")
  })

  it("warns that matchdays and opponents change on regeneration", () => {
    for (const leagueFormat of ["BEST_OF_SINGLE", "DOUBLE_ROUND_ROBIN"] as const) {
      const t = scheduleDialogText({ hasSchedule: true, leagueFormat })
      expect(t.title).toBe("Spielplan neu generieren?")
      expect(t.confirmLabel).toBe("Neu generieren")
      expect(t.description).toContain("Gegner ändern sich")
      expect(t.description).toContain("aktiven Teilnehmer")
      expect(t.description).not.toContain("bleiben erhalten")
    }
  })
})
