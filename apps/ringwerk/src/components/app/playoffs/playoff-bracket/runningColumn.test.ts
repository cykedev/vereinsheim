import { describe, expect, it } from "vitest"

import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"

import { runningColumn } from "./runningColumn"

const match = (round: PlayoffMatchItem["round"], done: boolean): PlayoffMatchItem =>
  ({
    id: `${round}-${done ? "x" : "o"}`,
    round,
    status: done ? "COMPLETED" : "PENDING",
  }) as PlayoffMatchItem

const bracket = (parts: Partial<PlayoffBracketData>): PlayoffBracketData => ({
  competitionId: "c",
  eighthFinals: [],
  quarterFinals: [],
  semiFinals: [],
  final: null,
  ...parts,
})

describe("runningColumn", () => {
  it("die erste Runde mit offener Paarung", () => {
    const b = bracket({
      eighthFinals: [match("EIGHTH_FINAL", true), match("EIGHTH_FINAL", true)],
      quarterFinals: [match("QUARTER_FINAL", true), match("QUARTER_FINAL", false)],
    })
    expect(runningColumn(b, true, false)).toBe(1)
  })

  it("zählt die Spalten nach den gezeigten Runden: ohne Achtelfinale ist das Viertelfinale die erste", () => {
    const b = bracket({ quarterFinals: [match("QUARTER_FINAL", false)] })
    expect(runningColumn(b, false, true)).toBe(0)
    const semi = bracket({ semiFinals: [match("SEMI_FINAL", false)] })
    expect(runningColumn(semi, false, false)).toBe(0)
  })

  it("alles entschieden: die letzte Runde mit Paarungen", () => {
    const b = bracket({
      semiFinals: [match("SEMI_FINAL", true), match("SEMI_FINAL", true)],
      final: match("FINAL", true),
    })
    expect(runningColumn(b, false, false)).toBe(1)
  })

  it("ohne Paarung die erste Spalte", () => {
    expect(runningColumn(bracket({}), true, false)).toBe(0)
  })
})
