import { describe, expect, it } from "vitest"

import { CARD, MATCH } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
import { dataCoverage } from "./coverage"

describe("Datenlage (Q1)", () => {
  it("zählt Wertung, Probe, fehlende Angaben und Merkmale", () => {
    const pdfOnly: MetricShot = { ...MATCH[0], xUm: null, yUm: null, firedAtMs: null }
    const placeholder: MetricShot = { ...MATCH[1], flags: ["verdaechtig"] }
    const miss: MetricShot = { ...MATCH[2], flags: ["fehlschuss"] }
    const noValue: MetricShot = { ...MATCH[3], decimalTenths: null, ring: null }
    expect(dataCoverage([...CARD, pdfOnly, placeholder, miss, noValue])).toEqual({
      match: 10,
      probe: 5,
      withoutPosition: 1,
      withoutTime: 1,
      withoutValue: 1,
      flags: { verdaechtig: 1, fehlschuss: 1 },
    })
  })
})
