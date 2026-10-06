import { describe, expect, it } from "vitest"

import { MATCH } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
import { pauseRecovery, rhythmProfile, shootingTime, tempoSpread } from "./timing"

// Zehn Wertungsschüsse; Abstände 40, 45, 40, 45, 40 s, dann 300 s Pause, dann 50, 55, 50 s.
// Nach der Pause fallen die Werte ab (9,5 · 9,7 · 9,9).
const SECONDS = [0, 40, 85, 125, 170, 210, 510, 560, 615, 665]
const VALUES = [102, 103, 101, 104, 102, 103, 95, 97, 99, 104]
const EVENING: MetricShot[] = SECONDS.map((s, i) => ({
  ...MATCH[0],
  seq: i + 1,
  firedAtMs: s * 1000,
  decimalTenths: VALUES[i],
  ring: Math.floor(VALUES[i] / 10),
}))

describe("Tempo-Konstanz und Schießzeit (Z2, Z3)", () => {
  it("IQR der Intervalle ohne Pause, auch relativ zum Median", () => {
    const spread = tempoSpread(EVENING)
    expect(spread?.n).toBe(8)
    expect(spread?.iqrMs).toBe(10_000)
    expect(spread?.medianMs).toBe(45_000)
    expect(spread?.relative).toBeCloseTo(10 / 45, 9)
  })

  it("Dauer, Netto-Zeit ohne Pause, Schüsse je Stunde", () => {
    const time = shootingTime(EVENING)
    expect(time?.durationMs).toBe(665_000)
    expect(time?.netMs).toBe(365_000)
    expect(time?.shotsPerHour).toBeCloseTo(10 / (365 / 3600), 9)
  })

  it("nach einem Sprung der Uhr keine Dauer", () => {
    const jumped = EVENING.map((shot, i) => ({
      ...shot,
      firedAtMs: (shot.firedAtMs as number) - (i >= 5 ? 3_600_000 : 0),
    }))
    expect(shootingTime(jumped)?.durationMs).toBeNull()
  })
})

describe("Pausen und Rhythmus (Z4, Z5)", () => {
  it("Wiedereinstieg: Ø der drei Schüsse nach der Pause gegen den Scheiben-Ø", () => {
    const recovery = pauseRecovery(EVENING, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.totalPauseMs).toBe(300_000)
    expect(recovery?.effects).toEqual([{ afterShot: 7, deltaRings: -0.4 }])
    expect(recovery?.meanDelta).toBeCloseTo(-0.4, 9)
  })

  it("Wiedereinstieg in ganzen Ringen: dreimal 9 gegen Ø 9,7", () => {
    const recovery = pauseRecovery(EVENING, "rings")
    expect(recovery?.effects).toHaveLength(1)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-0.7, 9)
    const ringsOnly = EVENING.map((shot) => ({ ...shot, decimalTenths: null }))
    expect(pauseRecovery(ringsOnly, "rings")?.pauses).toBe(1)
    expect(pauseRecovery(ringsOnly, "decimal")).toBeNull()
  })

  it("ohne Pause keine Effekte", () => {
    expect(pauseRecovery(EVENING.slice(0, 5), "decimal")?.effects).toEqual([])
    expect(pauseRecovery([], "decimal")).toBeNull()
  })

  it("gleitender Median der Intervalle; eine Pause zählt nicht hinein", () => {
    const profile = rhythmProfile(EVENING, 5)
    expect(profile).toHaveLength(10)
    expect(profile[0]).toMatchObject({ number: 1, intervalMs: null, medianMs: null, pause: false })
    expect(profile[2].medianMs).toBe(42_500)
    expect(profile[6]).toMatchObject({
      number: 7,
      intervalMs: 300_000,
      pause: true,
      medianMs: 40_000,
    })
    expect(profile[7].medianMs).toBe(45_000)
  })
})
