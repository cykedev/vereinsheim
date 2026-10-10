import { describe, expect, it } from "vitest"

import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"

import { CASES } from "./cases/index"
import { frozenReadings } from "./frozen"

describe("frozenReadings", () => {
  it("liest jeden Fall, und jeder Snapshot erfüllt den Vertrag", () => {
    for (const { id } of CASES) {
      const readings = frozenReadings(id)
      expect(readings.length, id).toBeGreaterThan(0)
      for (const { snapshots } of readings)
        for (const snapshot of snapshots) expect(parseSnapshot(snapshot).ok, id).toBe(true)
    }
  })

  it("SF-71: fünf Lesungen, die erste, dritte und fünfte mit gleichem Stand", () => {
    const sums = frozenReadings("SF-71").map((r) => r.snapshots[0].checksum)
    expect(sums).toHaveLength(5)
    expect(sums[2]).toBe(sums[0])
    expect(sums[4]).toBe(sums[0])
    expect(new Set(sums).size).toBe(3)
  })

  it("nur Fall-Kennungen", () => {
    expect(() => frozenReadings("../package")).toThrow(RangeError)
  })
})
