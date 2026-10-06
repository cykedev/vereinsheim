import { describe, expect, it } from "vitest"

import { PAUSE_THRESHOLD_MS, tempo } from "./time"

const s = (seconds: number) => seconds * 1000

describe("tempo", () => {
  it("Pausen über drei Minuten zählen getrennt und nicht zum Median (SF-62)", () => {
    expect(tempo([0, s(50), s(105), s(400), s(452)])).toEqual({
      intervalsMs: [s(50), s(55), s(52)],
      pausesMs: [s(295)],
      clockJumps: 0,
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
      clockJumps: 0,
      medianIntervalMs: null,
      longestPauseMs: null,
      durationMs: 0,
    })
    expect(tempo([]).durationMs).toBeNull()
  })

  it("bei gerader Zahl ist der Median das Mittel der beiden mittleren Intervalle", () => {
    expect(tempo([0, s(10), s(30), s(60), s(100)]).medianIntervalMs).toBe(s(25))
  })

  it("nimmt die Abgabefolge; springt die Uhr zurück, zählt der Abstand nicht (SF-30)", () => {
    const hour = 3_600_000
    const pace = tempo([0, s(50), s(100), s(100) - hour, s(150) - hour])
    expect(pace.intervalsMs).toEqual([s(50), s(50), s(50)])
    expect(pace.pausesMs).toEqual([])
    expect(pace.clockJumps).toBe(1)
    expect(pace.medianIntervalMs).toBe(s(50))
    // Über einen Sprung der Uhr hinweg ist die Dauer unbekannt.
    expect(pace.durationMs).toBeNull()
  })

  it("eine Lücke (null) trennt die Folge: Die Abstände daneben zählen nicht", () => {
    const pace = tempo([0, s(100), null, s(300), s(400)])
    expect(pace.intervalsMs).toEqual([s(100), s(100)])
    expect(pace.pausesMs).toEqual([])
    expect(pace.durationMs).toBe(s(400))
    expect(tempo([0, Number.NaN, s(50)]).intervalsMs).toEqual([])
  })
})
