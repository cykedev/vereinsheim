import { describe, expect, it } from "vitest"

import { MATCH } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { permutationMeanTest } from "../stats"
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

// 20 Wertungsschüsse: Serie 1 im Takt von 30 s, Serie 2 im Takt von 60 s mit 110 s vor Schuss 15. Die Karte hat den
// Median 30 s, also die Schwelle 60 s: 110 s ist eine Pause, 60 s noch nicht. Serie 2 allein hätte den Median 60 s und
// die Schwelle 120 s; dann wäre es keine.
const GAPS = [...Array(10).fill(30), 60, 60, 60, 110, 60, 60, 60, 60, 60]
const TWO_PACES: MetricShot[] = GAPS.reduce<number[]>(
  (times, gap) => [...times, times.at(-1)! + gap],
  [0]
).map((s, i) => ({
  ...MATCH[0],
  seq: i + 1,
  series: i < 10 ? 1 : 2,
  firedAtMs: s * 1000,
  decimalTenths: 100,
  ring: 10,
}))

describe("Pause relativ zum Takt der Karte", () => {
  it("Z4 erkennt 110 s bei einem Takt von 30 s und nennt die Schwelle", () => {
    const recovery = pauseRecovery(TWO_PACES, "decimal")
    expect(recovery?.rule).toEqual({ thresholdMs: 60_000, typicalMs: 30_000, basis: "takt" })
    expect(recovery?.effects.map((e) => e.afterShot)).toEqual([15])
  })

  it("eine Serie nimmt die Schwelle der ganzen Karte, nicht ihre eigene", () => {
    const second = TWO_PACES.slice(10)
    const pauses = (points: ReturnType<typeof rhythmProfile>) =>
      points.filter((p) => p.pause).map((p) => p.number)
    // Nummern innerhalb der Auswahl: Schuss 15 der Karte ist der fünfte der Serie
    expect(pauses(rhythmProfile(second, 5, TWO_PACES))).toEqual([5])
    // Gegenprobe: ohne Karte gilt der Takt der Serie, 110 s bleibt unter 120 s
    expect(pauses(rhythmProfile(second))).toEqual([])
    // die Streuung des Tempos ohne die Pause
    expect(tempoSpread(second, TWO_PACES)?.n).toBe(8)
    expect(tempoSpread(second)?.n).toBe(9)
  })
})

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
    // die drei danach sind die drei kleinsten von zehn: nur eine von C(10, 3) = 120 Auswahlen ist so extrem
    expect(recovery?.effects[0]).toMatchObject({ clear: true, direction: "down" })
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
    expect(blind?.effects).toEqual([
      { afterShot: 7, deltaRings: null, clear: false, direction: null },
    ])
    expect(blind?.meanDelta).toBeNull()
  })

  it("haben die Schüsse nach der Pause alle keinen Wert, gibt es keine Wirkung, aber die Pause", () => {
    // Schüsse 7 bis 9 ohne Zehntel, die übrigen mit: kein Schnitt danach, also null (nicht NaN)
    const blind = EVENING.map((shot, i) =>
      i >= 6 && i <= 8 ? { ...shot, decimalTenths: null } : shot
    )
    const recovery = pauseRecovery(blind, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.effects).toEqual([
      { afterShot: 7, deltaRings: null, clear: false, direction: null },
    ])
    expect(recovery?.meanDelta).toBeNull()
  })

  it("fehlt dem Schuss nach der Pause der Wert, bleibt die Pause (Grenzfall SF-18)", () => {
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

  it("eine späte Probe ist keine Lücke: die Pause vor Schuss 7 bleibt (ganze Karte, SF-04)", () => {
    // Wertung wie EVENING: nach der Pause Ø 9,7 gegen die übrigen sieben (Ø 719/70), −4/7 Ringe; die
    // Pause gilt von Wertungsschuss 6 (210 s) bis 7 (510 s), die Probe dazwischen gehört zu ihr
    const recovery = pauseRecovery(LATE_SIGHTER, "decimal")
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.totalPauseMs).toBe(300_000)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-4 / 7, 9)
  })

  it("eine späte Probe ist keine Lücke: die Pause vor Schuss 7 bleibt (nur Wertung, SF-04)", () => {
    const recovery = pauseRecovery(LATE_SIGHTER_MATCH, "decimal", LATE_SIGHTER)
    expect(recovery?.pauses).toBe(1)
    expect(recovery?.totalPauseMs).toBe(300_000)
    expect(recovery?.effects[0].afterShot).toBe(7)
    expect(recovery?.effects[0].deltaRings).toBeCloseTo(-4 / 7, 9)
    expect(rhythmProfile(LATE_SIGHTER_MATCH, 5, LATE_SIGHTER)[6]).toMatchObject({
      number: 7,
      intervalMs: 300_000,
      pause: true,
      medianMs: 40_000,
    })
    // Tempo wie EVENING: Abstände 40, 45, 40, 45, 40, 50, 55, 50 s ohne die Pause
    const spread = tempoSpread(LATE_SIGHTER_MATCH, LATE_SIGHTER)
    expect(spread?.n).toBe(8)
    expect(spread?.iqrMs).toBe(10_000)
    expect(spread?.medianMs).toBe(45_000)
  })

  it("ohne die Karte bleibt die Probe eine Lücke", () => {
    expect(rhythmProfile(LATE_SIGHTER_MATCH, 5)[6]).toMatchObject({ number: 7, intervalMs: null })
    expect(pauseRecovery(LATE_SIGHTER_MATCH, "decimal")?.pauses).toBe(0)
  })

  it("Rhythmus: Nummern sind Schussnummern, über eine Lücke gibt es keinen Abstand", () => {
    const profile = rhythmProfile(WITH_PLACEHOLDER, 5)
    expect(profile.map((p) => p.number)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10])
    expect(profile[2]).toMatchObject({ number: 4, kind: "match", intervalMs: null })
    expect(() => rhythmProfile(EVENING, 0)).toThrow(RangeError)
  })
})

describe("Was die Pause bewirkt hat (Z4, Urteil)", () => {
  // die übrigen 37 Werte: ein fester Kreis um 10,0, im Schnitt genau 10,0
  const CYCLE = [100, 97, 103, 99, 101, 96, 104, 98, 102]
  // 40 Wertungsschüsse im Takt von 30 s, vor jedem Schuss aus `pausesBefore` 300 s; Schuss 21 bis 23 mit `after`
  const card = (after: readonly number[], pausesBefore: readonly number[]): MetricShot[] => {
    let k = 0
    let seconds = 0
    return Array.from({ length: 40 }, (_, i) => {
      const number = i + 1
      if (i > 0) seconds += pausesBefore.includes(number) ? 300 : 30
      const tenths = number >= 21 && number <= 23 ? after[number - 21] : CYCLE[k++ % CYCLE.length]
      return {
        ...MATCH[0],
        seq: number,
        firedAtMs: seconds * 1000,
        decimalTenths: tenths,
        ring: Math.floor(tenths / 10),
      }
    })
  }
  const rest = Array.from({ length: 37 }, (_, i) => CYCLE[i % CYCLE.length])
  const first = (shots: MetricShot[], pauses = [21]) =>
    pauseRecovery(shots, "decimal")?.effects.find((e) => e.afterShot === pauses[0])

  it("klar schwächer und klar stärker, in die Richtung des Unterschieds", () => {
    expect(first(card([70, 70, 70], [21]))).toMatchObject({ clear: true, direction: "down" })
    expect(first(card([109, 109, 109], [21]))).toMatchObject({ clear: true, direction: "up" })
  })

  it("mitten in der Streuung: kein Urteil", () => {
    expect(first(card([99, 101, 102], [21]))).toMatchObject({ clear: false, direction: null })
  })

  it("mehrere Pausen: strengere Grenze (0,05 geteilt durch die Zahl der Pausen)", () => {
    const after = [95, 97, 98]
    const p = permutationMeanTest(after, rest)!.p
    // zwischen 0,025 und 0,05: allein klar, mit einer zweiten Pause nicht
    expect(p).toBeGreaterThanOrEqual(0.025)
    expect(p).toBeLessThan(0.05)
    expect(first(card(after, [21]))).toMatchObject({ clear: true, direction: "down" })
    const two = pauseRecovery(card(after, [21, 31]), "decimal")
    expect(two?.pauses).toBe(2)
    expect(two?.effects.find((e) => e.afterShot === 21)).toMatchObject({
      clear: false,
      direction: null,
    })
  })

  it("eine Pause ohne Werte danach zählt nicht für die strengere Grenze", () => {
    const after = [95, 97, 98]
    // zweite Pause vor Schuss 31, Schuss 31 bis 33 ohne Zehntel: kein Test, die Grenze bleibt 0,05
    const blind = card(after, [21, 31]).map((s, i) =>
      i >= 30 && i <= 32 ? { ...s, decimalTenths: null } : s
    )
    const restValues = blind
      .filter((s, i) => (i < 20 || i > 22) && s.decimalTenths !== null)
      .map((s) => s.decimalTenths as number)
    const p = permutationMeanTest(after, restValues)!.p
    expect(p).toBeGreaterThanOrEqual(0.025)
    expect(p).toBeLessThan(0.05)
    const recovery = pauseRecovery(blind, "decimal")
    expect(recovery?.pauses).toBe(2)
    expect(recovery?.tests).toBe(1)
    expect(recovery?.effects.find((e) => e.afterShot === 21)).toMatchObject({
      clear: true,
      direction: "down",
    })
  })

  it("gleiche Mittel: Unterschied genau 0 und kein Urteil", () => {
    const even = first(card([99, 100, 101], [21]))
    expect(even?.deltaRings).toBe(0)
    expect(even).toMatchObject({ clear: false, direction: null })
  })
})
