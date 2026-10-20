import { describe, expect, it } from "vitest"
import { scheduleRegenerationBlocker } from "./regeneration"

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
