import { describe, expect, it } from "vitest"

import { warmupIds, type WarmupCandidate } from "./warmup"

const HOUR_MS = 3_600_000
const T0 = Date.UTC(2026, 2, 10, 17)

/** eine Scheibe `hours` nach 18 Uhr, als Vorgabe am Abend 10.03. in der Familie lp */
const card = (
  id: string,
  probeOnly: boolean,
  hours: number,
  over: Partial<WarmupCandidate> = {}
): WarmupCandidate => ({
  id,
  startedAtMs: T0 + hours * HOUR_MS,
  evening: "2026-03-10",
  family: "lp",
  probeOnly,
  ...over,
})

const ids = (cards: readonly WarmupCandidate[]) => [...warmupIds(cards)].sort()

describe("Einschießen: Probe vor einer Wertung desselben Abends in derselben Familie", () => {
  it("Probe vor der Wertung ist Einschießen, die Wertung nicht", () => {
    expect(ids([card("p", true, 0), card("w", false, 1)])).toEqual(["p"])
  })

  it("Probe allein am Abend ist kein Einschießen, zwei Probe-Scheiben ohne Wertung auch nicht", () => {
    expect(ids([card("p", true, 0)])).toEqual([])
    expect(ids([card("p1", true, 0), card("p2", true, 1)])).toEqual([])
  })

  it("Probe in einer Familie, Wertung in einer anderen am selben Abend: kein Einschießen", () => {
    expect(ids([card("p", true, 0), card("w", false, 1, { family: "lg" })])).toEqual([])
  })

  it("Probe am Abend davor, Wertung am Abend danach: kein Einschießen", () => {
    expect(ids([card("p", true, 0, { evening: "2026-03-09" }), card("w", false, 1)])).toEqual([])
  })

  it("Probe nach der letzten Wertung zählt wie ein Training, Probe zwischen zwei Wertungen ist Einschießen", () => {
    expect(ids([card("w", false, 0), card("p", true, 1)])).toEqual([])
    expect(
      ids([card("w1", false, 0), card("p", true, 1), card("w2", false, 2), card("q", true, 3)])
    ).toEqual(["p"])
  })

  it("gleicher Beginn wie die Wertung: kein Einschießen", () => {
    expect(ids([card("p", true, 1), card("w", false, 1)])).toEqual([])
  })

  it("eine Scheibe ohne Werte (nicht nur Probe, wartet auf die Anlage) zählt als Wertung", () => {
    // ohne Werte ist eine Scheibe nie „nur Probe“: Die Projektion trägt `probeOnly: false`
    expect(ids([card("p", true, 0), card("scan", false, 2)])).toEqual(["p"])
  })

  it("die Folge der Eingabe ändert nichts", () => {
    const cards = [
      card("p1", true, 0),
      card("w", false, 1),
      card("p2", true, 2),
      card("p3", true, 0, { family: "lg" }),
    ]
    expect(ids([...cards].reverse())).toEqual(ids(cards))
    expect(ids(cards)).toEqual(["p1"])
  })
})
