import { describe, expect, it } from "vitest"

import { buildShotHistogramBuckets } from "./histogram"

describe("buildShotHistogramBuckets", () => {
  it("Ringwert-Farben wie am Bildschirm: 10 rot, 9 gold, 8 türkis, darunter violett", () => {
    const buckets = buildShotHistogramBuckets(["10.3", "9.8", "8.1", "7.0", "3"], true)
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
      "0",
    ])
    expect(buckets.slice(0, 5).map((bucket) => bucket.colorHex)).toEqual([
      "#e5484d",
      "#e9b10c",
      "#1fa3c8",
      "#7c5cd6",
      "#7c5cd6",
    ])
    expect(buckets.at(-1)?.colorHex).toBe("#7c5cd6")
  })

  it("zählt je Ring, Zehntel abgerundet", () => {
    const buckets = buildShotHistogramBuckets(["10.3", "9.8", "9.1", "x"], true)
    expect(buckets.slice(0, 2).map((bucket) => bucket.value)).toEqual([1, 2])
  })
})
