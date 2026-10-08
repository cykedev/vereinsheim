import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import {
  defaultWhole,
  formatScore,
  groupShots,
  hasPosition,
  isProbeShot,
  probeOnlyAsMatch,
  selectionShots,
  seriesKeyOf,
  shotLabels,
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
  it("Serie eines Schusses: Probe oder die Seriennummer, ohne Nummer keine Serie", () => {
    expect(CARD.map(seriesKeyOf)).toEqual(["probe", "probe", 1, 1, 2])
    expect(seriesKeyOf(shot("match", null, 0, 100))).toBeNull()
  })

  it("Schüsse ohne Serie zählen nur bei „alle“, wie im Fachkern (seriesCurve)", () => {
    const loose = shot("match", null, 500, 100)
    const card = [...CARD, loose]
    expect(groupShots(card, "all")).toContain(loose)
    expect(groupShots(card, 1)).not.toContain(loose)
    expect(selectionShots(card, "all")).toContain(loose)
    expect(selectionShots(card, 1)).not.toContain(loose)
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

  it("Gruppe der Auswahl: ihre Schüsse mit Lage", () => {
    expect(groupShots(CARD, "match")).toEqual([CARD[2], CARD[3], CARD[4]])
    expect(groupShots(CARD, 2)).toEqual([CARD[4]])
    expect(groupShots(CARD, 1)).toEqual([CARD[2], CARD[3]])
    expect(groupShots(CARD, "probe")).toEqual([CARD[0], CARD[1]])
  })

  it("Schüsse der Auswahl für Kennzahlen: auch ohne Lage", () => {
    const noPosition = shot("match", 1, null, 100)
    const card = [...CARD, noPosition]
    expect(selectionShots(card, "match")).toEqual([CARD[2], CARD[3], CARD[4], noPosition])
    expect(selectionShots(card, 1)).toEqual([CARD[2], CARD[3], noPosition])
    expect(selectionShots(card, "probe")).toEqual([CARD[0], CARD[1]])
  })

  it("nur Probe (Training): wie Wertung, Serien zu zehn in Abgabefolge", () => {
    // zwölf Probeschüsse, in der Liste vertauscht: Serien und Nummern folgen der Abgabefolge (seq)
    const probes = Array.from({ length: 12 }, (_, i) => ({
      ...shot("probe", null, i * 100, 100),
      seq: i + 1,
    }))
    const shuffled = [...probes].reverse()
    const card = probeOnlyAsMatch(shuffled)
    expect(card.every((s: MetricShot) => s.kind === "match")).toBe(true)
    // gleiche Reihenfolge wie die Eingabe, nur Art und Serie neu
    expect(card.map((s: MetricShot) => s.seq)).toEqual(shuffled.map((s) => s.seq))
    expect(card.map((s: MetricShot) => s.series)).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(shotLabels(probeOnlyAsMatch(probes))).toEqual(probes.map((_, i) => String(i + 1)))
    expect(card.map((s: MetricShot) => s.xUm)).toEqual(shuffled.map((s) => s.xUm))
  })

  it("ein umgedeuteter Schuss bleibt als Probe erkennbar (für das Probe-Eck)", () => {
    const probes = Array.from({ length: 3 }, (_, i) => ({
      ...shot("probe", null, i, 100),
      seq: i + 1,
    }))
    expect(probeOnlyAsMatch(probes).every(isProbeShot)).toBe(true)
    expect(isProbeShot(CARD[0])).toBe(true)
    expect(isProbeShot(CARD[2])).toBe(false)
  })

  it("folgt Wertung, bleibt die Probe Probe; ohne Schüsse nichts", () => {
    expect(probeOnlyAsMatch(CARD)).toBe(CARD)
    expect(probeOnlyAsMatch([])).toEqual([])
  })

  it("Grundauswahl: ohne Probe, wenn es Probe und Wertung gibt, sonst alle", () => {
    expect(defaultWhole(CARD)).toBe("match")
    expect(defaultWhole(CARD.filter((s) => s.kind === "match"))).toBe("all")
    expect(defaultWhole(CARD.filter((s) => s.kind === "probe"))).toBe("all")
    expect(defaultWhole([])).toBe("all")
  })

  it("alle mit Probe rechnen mit der Probe, ohne Probe nur mit der Wertung", () => {
    expect(selectionShots(CARD, "all")).toEqual(CARD)
    expect(selectionShots(CARD, "match")).toEqual(CARD.slice(2))
    expect(groupShots(CARD, "all")).toEqual(CARD)
    expect(groupShots(CARD, "match")).toEqual(CARD.slice(2))
  })
})
