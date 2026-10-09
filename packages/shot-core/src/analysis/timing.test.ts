import { describe, expect, it } from "vitest"

import { MATCH } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { pauseRecovery, rhythmProfile, tempoSpread } from "./timing"

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
// Schuss 3 ist ein Platzhalter: seine Zeit zählt nicht (SF-15), der Abstand vor Schuss 4 fehlt.
const WITH_PLACEHOLDER = EVENING.map((shot, i) =>
  i === 2 ? { ...shot, flags: [FLAG_SUSPICIOUS] } : shot
)
// Dieselben zehn Wertungsschüsse mit einer späten Probe in der Pause (bei 460 s): Die Abgabefolge läuft
// über beide Arten, die Probe hat seq 7, in der Wertung springt sie von 6 auf 8.
const LATE_SIGHTER: MetricShot[] = [
  ...EVENING.slice(0, 6),
  { ...EVENING[5], kind: "probe", series: null, seq: 7, firedAtMs: 460_000 },
  ...EVENING.slice(6).map((shot) => ({ ...shot, seq: (shot.seq as number) + 1 })),
]
const LATE_SIGHTER_MATCH = LATE_SIGHTER.filter((shot) => shot.kind === "match")

describe("Tempo-Konstanz (Z2)", () => {
  it("IQR der Intervalle ohne Pause, auch relativ zum Median", () => {
    const spread = tempoSpread(EVENING)
    expect(spread?.n).toBe(8)
    expect(spread?.iqrMs).toBe(10_000)
    expect(spread?.medianMs).toBe(45_000)
    expect(spread?.relative).toBeCloseTo(10 / 45, 9)
  })
})

describe("Pausen und Rhythmus (Z4, Z5)", () => {
  it("Wiedereinstieg: Ø der drei Schüsse nach der Pause gegen die übrigen", () => {
    // nach der Pause 9,5 · 9,7 · 9,9 (Ø 9,7) gegen die übrigen sieben (Ø 719/70): −4/7 Ringe
    const recovery = pauseRecovery(EVENING, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.totalPauseMs).toBe(300_000)
    expect(recovery?.effects).toHaveLength(1)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-4 / 7, 9)
    expect(recovery?.meanDelta).toBeCloseTo(-4 / 7, 9)
  })

  it("die Pause behält ihre Schussnummer, auch wenn davor ein Platzhalter liegt", () => {
    expect(pauseRecovery(WITH_PLACEHOLDER, "decimal")?.effects[0].afterShot).toBe(7)
  })

  it("Wiedereinstieg in ganzen Ringen: dreimal 9 gegen sonst nur 10", () => {
    const recovery = pauseRecovery(EVENING, "rings")
    expect(recovery?.effects).toHaveLength(1)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBe(-1)
    const ringsOnly = EVENING.map((shot) => ({ ...shot, decimalTenths: null }))
    expect(pauseRecovery(ringsOnly, "rings")?.pauses).toBe(1)
    // die Pause steht über die Zeiten fest, nur ihre Wirkung braucht Werte
    const blind = pauseRecovery(ringsOnly, "decimal")
    expect(blind?.pauses).toBe(1)
    expect(blind?.effects).toEqual([{ afterShot: 7, deltaRings: null }])
    expect(blind?.meanDelta).toBeNull()
  })

  it("haben die Schüsse nach der Pause alle keinen Wert, gibt es keine Wirkung, aber die Pause", () => {
    // Schüsse 7 bis 9 ohne Zehntel, die übrigen mit: kein Schnitt danach, also null (nicht NaN)
    const blind = EVENING.map((shot, i) =>
      i >= 6 && i <= 8 ? { ...shot, decimalTenths: null } : shot
    )
    const recovery = pauseRecovery(blind, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.effects).toEqual([{ afterShot: 7, deltaRings: null }])
    expect(recovery?.meanDelta).toBeNull()
  })

  it("fehlt dem Schuss nach der Pause der Wert, bleibt die Pause (Prüfung, Grenzfall SF-18)", () => {
    // Schuss 7 ohne Zehntel: Die Pause davor zeigt der Rhythmus weiter; die Wirkung rechnet über die
    // Schüsse mit Wert: danach 9,7 · 9,9 (Ø 9,8) gegen die übrigen sieben (Ø 719/70): −33/70 Ringe
    const gap = EVENING.map((shot, i) => (i === 6 ? { ...shot, decimalTenths: null } : shot))
    const recovery = pauseRecovery(gap, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.totalPauseMs).toBe(300_000)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-33 / 70, 9)
    expect(
      rhythmProfile(gap)
        .filter((point) => point.pause)
        .map((point) => point.number)
    ).toEqual([7])
  })

  it("ohne Pause keine Effekte", () => {
    expect(pauseRecovery(EVENING.slice(0, 5), "decimal")?.effects).toEqual([])
    expect(pauseRecovery([], "decimal")).toBeNull()
    // ein Schuss hat keinen Abstand: weder Pause noch „keine Pause“
    expect(pauseRecovery(EVENING.slice(0, 1), "decimal")).toBeNull()
    // zwei Schüsse mit Zeit, aber kein messbarer Abstand (Schuss dazwischen fehlt, SF-30): ebenso
    expect(pauseRecovery([EVENING[0], EVENING[2]], "decimal")).toBeNull()
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

  it("Rhythmus in derselben Reihenfolge wie die Nummern, auch ohne Abgabefolge für alle", () => {
    // Handeintrag ohne seq und Zeit vorn; danach zehn Schuss mit seq 10 … 1, zeitlich aufsteigend
    const hand: MetricShot = { ...EVENING[0], seq: null, firedAtMs: null }
    const reversed = EVENING.map((shot, i) => ({ ...shot, seq: 10 - i }))
    const profile = rhythmProfile([hand, ...reversed], 5)
    expect(profile.map((p) => p.number)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(profile[1].intervalMs).toBe(40_000)
  })

  // bekannter Fehler, Plan plans/2026-10-09-spiegel-seq-luecke.md: Task 2 macht daraus `it`
  it.fails("eine späte Probe ist keine Lücke: die Pause vor Schuss 7 bleibt (ganze Karte)", () => {
    // Wertung wie EVENING: nach der Pause Ø 9,7 gegen die übrigen sieben (Ø 719/70), −4/7 Ringe
    const recovery = pauseRecovery(LATE_SIGHTER, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-4 / 7, 9)
  })

  it.fails("eine späte Probe ist keine Lücke: die Pause vor Schuss 7 bleibt (nur Wertung)", () => {
    expect(pauseRecovery(LATE_SIGHTER_MATCH, "decimal")?.pauses).toBe(1)
    const seven = rhythmProfile(LATE_SIGHTER_MATCH).find((point) => point.number === 7)
    expect(seven?.pause).toBe(true)
  })

  it("Rhythmus: Nummern sind Schussnummern, über eine Lücke gibt es keinen Abstand", () => {
    const profile = rhythmProfile(WITH_PLACEHOLDER, 5)
    expect(profile.map((p) => p.number)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10])
    expect(profile[2]).toMatchObject({ number: 4, kind: "match", intervalMs: null })
    expect(() => rhythmProfile(EVENING, 0)).toThrow(RangeError)
  })
})
