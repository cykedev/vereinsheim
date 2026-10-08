import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import {
  formatScore,
  groupShots,
  hasPosition,
  seriesKeyOf,
  shotLabels,
  sightAdjustCut,
} from "./shots"

const shot = (
  kind: "probe" | "match",
  series: number | null,
  xUm: number | null,
  tenths: number | null
): MetricShot => ({
  xUm,
  yUm: xUm === null ? null : 0,
  decimalTenths: tenths,
  ring: tenths === null ? null : Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind,
  series,
})

// zwei Probeschüsse, dann Serie 1 mit zwei und Serie 2 mit einem Schuss
const CARD = [
  shot("probe", null, 3000, 96),
  shot("probe", null, 1000, 101),
  shot("match", 1, 0, 109),
  shot("match", 1, 2000, 104),
  shot("match", 2, -1000, 106),
]

describe("Schüsse für die Bausteine", () => {
  it("Serie eines Schusses: Probe oder die Seriennummer", () => {
    expect(CARD.map(seriesKeyOf)).toEqual(["probe", "probe", 1, 1, 2])
  })

  it("Beschriftung je Art in Abgabefolge: Probe P1, P2, Wertung 1, 2, 3", () => {
    expect(shotLabels(CARD)).toEqual(["P1", "P2", "1", "2", "3"])
  })

  it("Wert in der gewählten Wertung, ohne Wert ein Strich", () => {
    expect(formatScore(CARD[2], "decimal")).toBe("10,9")
    expect(formatScore(CARD[2], "rings")).toBe("10")
    expect(formatScore(shot("match", 1, 0, null), "decimal")).toBe("–")
    expect(formatScore({ ...CARD[2], ring: 0, decimalTenths: 0 }, "decimal")).toBe("0,0")
  })

  it("Lage vorhanden?", () => {
    expect(hasPosition(CARD[0])).toBe(true)
    expect(hasPosition(shot("match", 1, null, 100))).toBe(false)
  })

  it("Visier verstellt: Probeschüsse bis einschließlich dieser Nummer liegen davor", () => {
    expect(sightAdjustCut(CARD, [1])).toBe(1)
    // nach dem letzten Probeschuss gibt es keine Probe danach: zählt nicht
    expect(sightAdjustCut(CARD, [2])).toBe(0)
    expect(sightAdjustCut(CARD, [])).toBe(0)
  })

  it("Gruppe der Auswahl: deren Wertungsschüsse mit Lage, ohne Wertung die gewählte Probe", () => {
    expect(groupShots(CARD, "all")).toEqual([CARD[2], CARD[3], CARD[4]])
    expect(groupShots(CARD, [2])).toEqual([CARD[4]])
    expect(groupShots(CARD, ["probe"])).toEqual([CARD[0], CARD[1]])
    expect(groupShots(CARD, ["probe", 1])).toEqual([CARD[2], CARD[3]])
  })
})
