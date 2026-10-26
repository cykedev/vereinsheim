import { describe, expect, it } from "vitest"

import {
  baseShotFlags,
  detailFlags,
  FLAG_TARGET_MISMATCH,
  FLAG_UNKNOWN_DISCIPLINE,
  mappingFlags,
  revisionCounts,
  verifyShots,
  type CheckableShot,
} from "./card-checks"

// Luftpistole, Abstände aus der Gegenprobe des Ausdrucks vom 2. Oktober 2026 ([[spiegel-target-library]]); Teiler in
// 1/100 mm, `distanceTenthsUm` in 0,1 µm
const lp = (teiler: number, decimalTenths: number, innerTen = false): CheckableShot => ({
  xUm: null,
  yUm: null,
  distanceTenthsUm: Math.round(teiler * 100),
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen,
  flags: [],
})
const fitting = [lp(331.8, 105, true), lp(2656, 76), lp(547.4, 103), lp(3369, 67)]

describe("verifyShots", () => {
  it("passende Werte: nichts verdächtig, das Scheibenbild passt", () => {
    expect(verifyShots("lp-10m", fitting)).toEqual({
      suspicious: [false, false, false, false],
      targetMismatch: false,
    })
  })

  it("ein falscher Zehntel ist verdächtig (SF-15)", () => {
    const shots = fitting.map((s, i) => (i === 1 ? { ...s, decimalTenths: 95, ring: 9 } : s))
    expect(verifyShots("lp-10m", shots).suspicious).toEqual([false, true, false, false])
  })

  it("fast alle daneben: das Scheibenbild passt nicht, dann ist keiner verdächtig (SF-16)", () => {
    expect(verifyShots("lg-10m", fitting)).toEqual({
      suspicious: [false, false, false, false],
      targetMismatch: true,
    })
  })

  it("ohne Scheibenbild und bei Schüssen mit Merkmal wird nichts geprüft", () => {
    expect(verifyShots(null, fitting)).toEqual({
      suspicious: [false, false, false, false],
      targetMismatch: false,
    })
    const flagged = fitting.map((s) => ({ ...s, decimalTenths: 95, flags: ["fehlschuss"] }))
    expect(verifyShots("lp-10m", flagged).suspicious).toEqual([false, false, false, false])
  })
})

describe("baseShotFlags", () => {
  const shot = {
    xUm: 1200,
    yUm: -300,
    distanceTenthsUm: 12_369,
    decimalTenths: 104,
    overTarget: false,
  }

  it("über Soll geht vor, dann der Platzhalter, dann der Fehlschuss", () => {
    expect(baseShotFlags({ ...shot, overTarget: true })).toEqual(["ueber-soll"])
    expect(
      baseShotFlags({ ...shot, xUm: 0, yUm: 0, distanceTenthsUm: 0, decimalTenths: 0 })
    ).toEqual(["verdaechtig"])
    expect(baseShotFlags({ ...shot, decimalTenths: 0 })).toEqual(["fehlschuss"])
    expect(baseShotFlags(shot)).toEqual([])
  })

  it("Lage 0/0 mit Abstand ab 1 µm oder mit 10,9 ist ein echter Treffer", () => {
    expect(
      baseShotFlags({ ...shot, xUm: 0, yUm: 0, distanceTenthsUm: 10, decimalTenths: 109 })
    ).toEqual([])
    expect(
      baseShotFlags({ ...shot, xUm: 0, yUm: 0, distanceTenthsUm: 0, decimalTenths: 109 })
    ).toEqual([])
    expect(
      baseShotFlags({ ...shot, xUm: 0, yUm: 0, distanceTenthsUm: 10, decimalTenths: 108 })
    ).toEqual([])
  })
})

describe("mappingFlags", () => {
  const base = { sighterShots: 5, targetId: "lp-10m" as const, targetMismatch: false }

  it("Vollständigkeit gegen die Schusszahl, nur Wertungsschüsse zählen (SF-02)", () => {
    expect(mappingFlags({ ...base, matchShots: 38, plannedShots: 40 })).toEqual(["unvollstaendig"])
    expect(mappingFlags({ ...base, matchShots: 40, plannedShots: 40 })).toEqual([])
    expect(mappingFlags({ ...base, matchShots: 41, plannedShots: 40 })).toEqual(["ueber-soll"])
    expect(mappingFlags({ ...base, matchShots: 7, plannedShots: null })).toEqual([])
    expect(mappingFlags({ ...base, matchShots: 0, plannedShots: 40 })).toEqual(["nur-probe"])
  })

  it("ohne Scheibenbild und bei unpassendem Scheibenbild", () => {
    expect(mappingFlags({ ...base, matchShots: 40, plannedShots: 40, targetId: null })).toEqual([
      FLAG_UNKNOWN_DISCIPLINE,
    ])
    expect(
      mappingFlags({ ...base, matchShots: 38, plannedShots: 40, targetMismatch: true })
    ).toEqual(["unvollstaendig", FLAG_TARGET_MISMATCH])
  })
})

describe("Scheiben mit Angaben ohne Einzelschüsse", () => {
  const total = { series: [], total: { shots: 40, rings: 371, decimalTenths: null }, center: null }

  it("revisionCounts: Wertungsschüsse aus den Zeilen, ohne sie aus den Summen", () => {
    const rows = [{ stellung: 0 }, { stellung: 1 }, { stellung: 1 }]
    expect(revisionCounts(rows, undefined)).toEqual({
      sighterShots: 1,
      matchShots: 2,
      valued: true,
    })
    expect(revisionCounts([], total)).toEqual({ sighterShots: 0, matchShots: 40, valued: true })
    expect(revisionCounts([], undefined)).toEqual({ sighterShots: 0, matchShots: 0, valued: false })
  })

  it("detailFlags: ohne Werte nicht leer, außer bei Scheiben der Brücke", () => {
    const empty = {
      sighterShots: 0,
      matchShots: 0,
      plannedShots: 40,
      targetId: "lg-10m" as const,
      targetMismatch: false,
      valued: false,
    }
    expect(detailFlags({ ...empty, origin: "pdf" })).toEqual([])
    expect(detailFlags({ ...empty, origin: "raw" })).toContain("leer")
    expect(detailFlags({ ...empty, origin: "manual", matchShots: 30, valued: true })).toContain(
      "unvollstaendig"
    )
  })
})
