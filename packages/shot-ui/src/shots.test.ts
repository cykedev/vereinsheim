import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import {
  asOnPrintout,
  formatShotValue,
  groupShots,
  hasPosition,
  isProbeShot,
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

// Serie 1 mit zwei und Serie 2 mit einem Schuss: eine Scheibe wie am Ausdruck
const CARD = [shot("match", 1, 0, 109), shot("match", 1, 2000, 104), shot("match", 2, -1000, 106)]
// so käme sie aus einer Ablage mit Probe davor
const WITH_PROBE = [shot("probe", null, 3000, 96), shot("probe", null, 1000, 101), ...CARD]

describe("Schüsse für die Bausteine", () => {
  it("Serie eines Schusses: die Seriennummer, ohne Nummer keine Serie", () => {
    expect(CARD.map(seriesKeyOf)).toEqual([1, 1, 2])
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

  it("Beschriftung in Abgabefolge: 1, 2, 3, keine „P“-Nummern neben Wertung", () => {
    expect(shotLabels(CARD)).toEqual(["1", "2", "3"])
    expect(shotLabels(asOnPrintout(WITH_PROBE))).toEqual(["1", "2", "3"])
  })

  it("Einzelschuss immer in Zehnteln, ohne Zehntel der Ring, ohne Wert ein Strich", () => {
    expect(formatShotValue(CARD[0])).toBe("10,9")
    expect(formatShotValue({ ...CARD[0], decimalTenths: null, ring: 9 })).toBe("9")
    expect(formatShotValue({ ...CARD[0], decimalTenths: null, ring: null })).toBe("–")
    expect(formatShotValue({ ...CARD[0], ring: 0, decimalTenths: 0 })).toBe("0,0")
  })

  it("Lage vorhanden?", () => {
    expect(hasPosition(CARD[0])).toBe(true)
    expect(hasPosition(shot("match", 1, null, 100))).toBe(false)
  })

  it("Gruppe der Auswahl: ihre Schüsse mit Lage", () => {
    expect(groupShots(CARD, "all")).toEqual(CARD)
    expect(groupShots(CARD, 2)).toEqual([CARD[2]])
    expect(groupShots(CARD, 1)).toEqual([CARD[0], CARD[1]])
  })

  it("Schüsse der Auswahl für Kennzahlen: auch ohne Lage", () => {
    const noPosition = shot("match", 1, null, 100)
    const card = [...CARD, noPosition]
    expect(selectionShots(card, "all")).toEqual(card)
    expect(selectionShots(card, 1)).toEqual([CARD[0], CARD[1], noPosition])
  })

  it("nur Probe (Training): wie Wertung, Serien zu zehn in Abgabefolge", () => {
    // zwölf Probeschüsse, in der Liste vertauscht: Serien und Nummern folgen der Abgabefolge (seq)
    const probes = Array.from({ length: 12 }, (_, i) => ({
      ...shot("probe", null, i * 100, 100),
      seq: i + 1,
    }))
    const shuffled = [...probes].reverse()
    const card = asOnPrintout(shuffled)
    expect(card.every((s: MetricShot) => s.kind === "match")).toBe(true)
    // gleiche Reihenfolge wie die Eingabe, nur Art und Serie neu
    expect(card.map((s: MetricShot) => s.seq)).toEqual(shuffled.map((s) => s.seq))
    expect(card.map((s: MetricShot) => s.series)).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(shotLabels(asOnPrintout(probes))).toEqual(probes.map((_, i) => String(i + 1)))
    expect(card.map((s: MetricShot) => s.xUm)).toEqual(shuffled.map((s) => s.xUm))
  })

  it("ein umgedeuteter Schuss bleibt als Probe erkennbar (für das Probe-Eck)", () => {
    const probes = Array.from({ length: 3 }, (_, i) => ({
      ...shot("probe", null, i, 100),
      seq: i + 1,
    }))
    expect(asOnPrintout(probes).every(isProbeShot)).toBe(true)
    expect(isProbeShot(WITH_PROBE[0])).toBe(true)
    expect(isProbeShot(CARD[0])).toBe(false)
  })

  it("wie am Ausdruck: mit Wertung nur die Wertung, ohne Probe-Eck; ohne Schüsse nichts", () => {
    expect(asOnPrintout(WITH_PROBE)).toEqual(CARD)
    expect(asOnPrintout(WITH_PROBE).some(isProbeShot)).toBe(false)
    expect(asOnPrintout(CARD)).toBe(CARD)
    expect(asOnPrintout([])).toEqual([])
  })
})
