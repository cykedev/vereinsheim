import { describe, expect, it } from "vitest"

import {
  gapsOf,
  pauseRule,
  PAUSE_ALWAYS_MS,
  PAUSE_FACTOR,
  PAUSE_MIN_INTERVALS,
  PAUSE_MIN_MS,
  pauseThresholdMs,
  tempo,
} from "./time"

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
      // unter fünf Abständen nur die feste Grenze
      pauseThresholdMs: s(180),
    })
  })

  it("genau drei Minuten sind noch keine Pause", () => {
    expect(PAUSE_ALWAYS_MS).toBe(s(180))
    expect(tempo([0, s(180)]).pausesMs).toEqual([])
    expect(tempo([0, s(180) + 1]).pausesMs).toEqual([s(180) + 1])
  })

  it("Pause relativ zum eigenen Takt: über dem 2,5-Fachen des Medians (User, 10. Oktober 2026)", () => {
    // acht Abstände zu 40 s und einer zu 120 s: Median 40 s, Schwelle 100 s
    const times = [0, 40, 80, 120, 160, 280, 320, 360, 400, 440].map(s)
    const pace = tempo(times)
    expect(pace.pauseThresholdMs).toBe(s(100))
    expect(pace.pausesMs).toEqual([s(120)])
    expect(pace.intervalsMs).toHaveLength(8)
    expect(pace.medianIntervalMs).toBe(s(40))
    // genau auf der Schwelle noch keine Pause
    expect(tempo([0, 40, 80, 120, 160, 260].map(s)).pausesMs).toEqual([])
    expect(tempo([0, 40, 80, 120, 160, 260].map(s)).pauseThresholdMs).toBe(s(100))
  })

  it("Schwelle nach Handwerten: 2,5-fach des Medians, mindestens 60 s, höchstens 180 s", () => {
    expect([PAUSE_FACTOR, PAUSE_MIN_MS, PAUSE_MIN_INTERVALS]).toEqual([2.5, s(60), 5])
    const five = (seconds: number) => Array.from({ length: 5 }, () => s(seconds))
    expect(pauseThresholdMs(five(40))).toBe(s(100))
    expect(pauseThresholdMs(five(20))).toBe(s(60))
    expect(pauseThresholdMs(five(90))).toBe(s(180))
    // unter fünf Abständen bis 180 s nur die feste Grenze
    expect(pauseThresholdMs([s(40), s(40), s(40), s(40)])).toBe(s(180))
    // der Median nur über Abstände bis 180 s: mit ihnen allen wäre er 190 s und die Schwelle 180 s
    expect(pauseThresholdMs([...five(30), ...Array.from({ length: 6 }, () => s(190))])).toBe(s(75))
    // genau 180 s gehört noch dazu: sechs Abstände, Median 30 s
    expect(pauseThresholdMs([s(30), s(30), s(30), s(30), s(180)])).toBe(s(75))
    // auf ganze Sekunden: Median 42,6 s ergibt 106,5 s, also 107 s
    expect(pauseThresholdMs([...five(42.6)])).toBe(s(107))
  })

  it("Grundlage der Schwelle: Takt, Mindestminute, feste Grenze oder zu wenige Abstände", () => {
    const five = (seconds: number) => Array.from({ length: 5 }, () => s(seconds))
    expect(pauseRule(five(40))).toEqual({ thresholdMs: s(100), typicalMs: s(40), basis: "takt" })
    expect(pauseRule(five(20))).toEqual({
      thresholdMs: s(60),
      typicalMs: s(20),
      basis: "mindestens",
    })
    expect(pauseRule(five(90))).toEqual({
      thresholdMs: s(180),
      typicalMs: s(90),
      basis: "hoechstens",
    })
    expect(pauseRule(five(40).slice(1))).toEqual({
      thresholdMs: s(180),
      typicalMs: null,
      basis: "fest",
    })
  })

  it("Abstände einer Folge: ohne Lücken und Rücksprünge", () => {
    expect(gapsOf([0, s(10), null, s(50), s(70), s(60), Number.NaN, s(90)])).toEqual([s(10), s(20)])
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
      pauseThresholdMs: s(180),
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
