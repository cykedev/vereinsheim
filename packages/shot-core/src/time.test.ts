import { describe, expect, it } from "vitest"

import { PAUSE_THRESHOLD_MS, tempo } from "./time"

const s = (seconds: number) => seconds * 1000

describe("tempo", () => {
  it("Pausen über drei Minuten zählen getrennt und nicht zum Median (SF-62)", () => {
    expect(tempo([0, s(50), s(105), s(400), s(452)])).toEqual({
      intervalsMs: [s(50), s(55), s(52)],
      pausesMs: [s(295)],
      medianIntervalMs: s(52),
      longestPauseMs: s(295),
      durationMs: s(452),
    })
  })

  it("genau drei Minuten sind noch keine Pause", () => {
    expect(PAUSE_THRESHOLD_MS).toBe(s(180))
    expect(tempo([0, s(180)]).pausesMs).toEqual([])
    expect(tempo([0, s(180) + 1]).pausesMs).toEqual([s(180) + 1])
  })

  it("ohne Pause ist die längste Pause 0", () => {
    expect(tempo([0, s(50), s(105)]).longestPauseMs).toBe(0)
  })

  it("ein Schuss hat kein Tempo, aber die Dauer 0; ohne Schuss gibt es nichts", () => {
    expect(tempo([s(10)])).toEqual({
      intervalsMs: [],
      pausesMs: [],
      medianIntervalMs: null,
      longestPauseMs: null,
      durationMs: 0,
    })
    expect(tempo([]).durationMs).toBeNull()
  })

  it("sortiert die Zeiten selbst", () => {
    expect(tempo([s(105), 0, s(452), s(50), s(400)])).toEqual(
      tempo([0, s(50), s(105), s(400), s(452)])
    )
  })
})
