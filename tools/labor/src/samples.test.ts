import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { rawSample, SAMPLES, toMetricShots } from "./samples"

describe("Beispielscheiben wie in der Spielwiese", () => {
  it("40 Schuss mit Probe: neun Probeschüsse, dann vier Serien zu zehn, immer gleich", () => {
    const raw = rawSample("lp-10m", "forty")
    expect(raw).toEqual(rawSample("lp-10m", "forty"))
    const shots = toMetricShots(LP_10M, raw)
    expect(shots).toHaveLength(49)
    expect(shots.slice(0, 9).every((s) => s.kind === "probe")).toBe(true)
    expect(shots.slice(9).map((s) => s.series)).toEqual(
      Array.from({ length: 40 }, (_, i) => Math.floor(i / 10) + 1)
    )
    // Schuss 27 der Luftpistole ist der Abreißer links unten, 30 mm und 35 mm neben dem Schwerpunkt
    expect(raw[9 + 26]).toMatchObject({ xUm: -3500 - 30000, yUm: 2200 - 35000 })
    // Lagen auf 1/100 mm wie bei Meyton
    expect(raw.every((s) => s.xUm % 10 === 0 && s.yUm % 10 === 0)).toBe(true)
  })

  it("nach Schuss 20 vier Minuten Pause", () => {
    const raw = rawSample("lg-10m", "forty")
    expect(raw[9 + 20].firedAtMs - raw[9 + 19].firedAtMs).toBe(240_000)
  })

  it("Ausdruck vom 2. Oktober: die sechs Teiler auf den Achsen", () => {
    const raw = rawSample("lp-10m", "printout")
    expect(raw.map((s) => distanceUm(s.xUm, s.yUm))).toEqual([
      3318, 3964, 5474, 26560, 33690, 38310,
    ])
    expect(raw[0]).toMatchObject({ xUm: 0, yUm: 3318 })
  })

  it("Werte und Serien aus der Wertung des Fachkerns", () => {
    const shots = toMetricShots(LG_10M, rawSample("lg-10m", "series"))
    expect(shots).toHaveLength(10)
    expect(shots.every((s) => s.kind === "match" && s.series === 1)).toBe(true)
    expect(
      shots.every((s) => typeof s.decimalTenths === "number" && typeof s.ring === "number")
    ).toBe(true)
    expect(shots.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("je Scheibe die passenden Beispiele", () => {
    expect(SAMPLES["lp-10m"].map((s) => s.id)).toEqual(["forty", "printout", "training", "empty"])
    expect(SAMPLES["lg-10m"].map((s) => s.id)).toEqual(["forty", "series", "training", "empty"])
    expect(rawSample("lp-10m", "empty")).toEqual([])
  })

  it("Training nur mit Probe: 60 Probeschüsse, nach Schuss 30 eine Pause, immer gleich", () => {
    const raw = rawSample("lp-10m", "training")
    expect(raw).toEqual(rawSample("lp-10m", "training"))
    expect(raw).toHaveLength(60)
    expect(raw.every((s) => s.kind === "probe")).toBe(true)
    expect(raw[30].firedAtMs - raw[29].firedAtMs).toBe(200_000)
  })
})
