import { describe, expect, it } from "vitest"
import { bestOfDuelTally, duelOutcome, resolveBestOf, stechschussOutcome } from "./bestOf"

const opts = (o: Partial<{ bestOf: number; playAll: boolean }> = {}) => ({
  bestOf: 3,
  playAll: true,
  ...o,
})

describe("resolveBestOf", () => {
  it("playAll: A wins all three -> complete A after 3 duels", () => {
    expect(resolveBestOf(["A", "A", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("playAll: still needs duels until N are played even when clinched", () => {
    expect(resolveBestOf(["A", "A"], [], opts())).toEqual({ kind: "in_progress" })
  })
  it("playAll: 2:1 after three -> complete A", () => {
    expect(resolveBestOf(["A", "B", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("early end: 2:0 stops before third duel", () => {
    expect(resolveBestOf(["A", "A"], [], opts({ playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
  it("level after N (one TIE) -> needs_tiebreak", () => {
    expect(resolveBestOf(["A", "B", "TIE"], [], opts())).toEqual({ kind: "needs_tiebreak" })
  })
  it("level after N, Stechschuss decides B", () => {
    expect(resolveBestOf(["A", "B", "TIE"], ["B"], opts())).toEqual({
      kind: "complete",
      winner: "B",
    })
  })
  it("Stechschuss tie repeats", () => {
    expect(resolveBestOf(["TIE", "TIE", "TIE"], ["TIE"], opts())).toEqual({
      kind: "needs_tiebreak",
    })
  })
  it("best-of-5 early end at 3 wins", () => {
    expect(resolveBestOf(["A", "B", "A", "A"], [], opts({ bestOf: 5, playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
})

const s = (rings: number, correctedTeiler: number, ringteiler: number) => ({
  rings,
  correctedTeiler,
  ringteiler,
})

describe("duelOutcome", () => {
  it("RINGTEILER: lower ringteiler wins", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.0, 7.0), "RINGTEILER", null, null)).toBe("B")
  })
  it("RINGTEILER: equal ringteiler from different rings/teiler -> TIE", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.7, 7.7), "RINGTEILER", null, null)).toBe("TIE")
  })
  it("RINGTEILER: optional tiebreaker RINGS breaks the tie -> A (more rings)", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.7, 7.7), "RINGTEILER", "RINGS", null)).toBe("A")
  })
  it("RINGS: higher rings wins", () => {
    expect(duelOutcome(s(96, 9, 0), s(95, 1, 0), "RINGS", null, null)).toBe("A")
  })
  it("RINGS: equal rings -> TIE without tiebreaker", () => {
    expect(duelOutcome(s(95, 1, 0), s(95, 9, 0), "RINGS", null, null)).toBe("TIE")
  })
  it("TEILER: lower corrected teiler wins", () => {
    expect(duelOutcome(s(90, 2.0, 12), s(90, 3.0, 13), "TEILER", null, null)).toBe("A")
  })
})

describe("stechschussOutcome", () => {
  it("home higher shot wins (A)", () => {
    expect(stechschussOutcome(9.8, 9.5)).toBe("A")
  })
  it("away higher shot wins (B)", () => {
    expect(stechschussOutcome(9.3, 9.7)).toBe("B")
  })
  it("equal shots → TIE", () => {
    expect(stechschussOutcome(9.5, 9.5)).toBe("TIE")
  })
})

describe("bestOfDuelTally", () => {
  it("decisive match counts regular duels directly (2:1)", () => {
    expect(bestOfDuelTally(["A", "B", "A"], { kind: "complete", winner: "A" })).toEqual({
      homeWins: 2,
      awayWins: 1,
      decidedByStechschuss: false,
    })
  })
  it("Stechschuss-decided tie is awarded to winner A (1:1 → 2:1)", () => {
    expect(bestOfDuelTally(["A", "B", "TIE"], { kind: "complete", winner: "A" })).toEqual({
      homeWins: 2,
      awayWins: 1,
      decidedByStechschuss: true,
    })
  })
  it("Stechschuss-decided tie is awarded to winner B (1:1 → 1:2)", () => {
    expect(bestOfDuelTally(["A", "B", "TIE"], { kind: "complete", winner: "B" })).toEqual({
      homeWins: 1,
      awayWins: 2,
      decidedByStechschuss: true,
    })
  })
  it("all-tie match awards every tie to the Stechschuss winner (0:0 → 3:0)", () => {
    expect(bestOfDuelTally(["TIE", "TIE", "TIE"], { kind: "complete", winner: "A" })).toEqual({
      homeWins: 3,
      awayWins: 0,
      decidedByStechschuss: true,
    })
  })
  it("dead-rubber tie at 2:0 stays a tie (not awarded)", () => {
    expect(bestOfDuelTally(["A", "A", "TIE"], { kind: "complete", winner: "A" })).toEqual({
      homeWins: 2,
      awayWins: 0,
      decidedByStechschuss: false,
    })
  })
  it("level but not yet decided: tie is not awarded", () => {
    expect(bestOfDuelTally(["A", "B", "TIE"], { kind: "needs_tiebreak" })).toEqual({
      homeWins: 1,
      awayWins: 1,
      decidedByStechschuss: false,
    })
  })
  it("in_progress reflects regular wins only", () => {
    expect(bestOfDuelTally(["A"], { kind: "in_progress" })).toEqual({
      homeWins: 1,
      awayWins: 0,
      decidedByStechschuss: false,
    })
  })
})
