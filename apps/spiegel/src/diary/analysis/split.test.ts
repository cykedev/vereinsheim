import { describe, expect, it } from "vitest"

import { splitAtMedian } from "./split"

const value = (item: { v: number }) => item.v
const items = (...vs: number[]) => vs.map((v, i) => ({ id: i, v }))

describe("splitAtMedian", () => {
  it("teilt über und unter dem Median, unabhängig von der Reihenfolge", () => {
    const split = splitAtMedian(items(90, 20, 80, 10, 100, 30), value)
    expect(split.high.map(value).sort()).toEqual([100, 80, 90])
    expect(split.low.map(value).sort()).toEqual([10, 20, 30])
  })

  it("gerade Zahl: der Median liegt zwischen zwei Werten, keiner auf ihm", () => {
    const split = splitAtMedian(items(10, 30, 50, 70), value)
    expect(split.high.map(value)).toEqual([50, 70])
    expect(split.low.map(value)).toEqual([10, 30])
  })

  it("Werte auf einer Stufe kommen zur kleineren Gruppe", () => {
    const rows = [
      ...Array.from({ length: 15 }, () => ({ v: 70 })),
      ...Array.from({ length: 5 }, () => ({ v: 80 })),
    ]
    const split = splitAtMedian(rows, value)
    expect(split.high).toHaveLength(5)
    expect(split.low).toHaveLength(15)
    // darüber liegt keiner: die auf dem Median sind die obere Gruppe
    const below = splitAtMedian([...rows.slice(0, 15), { v: 10 }, { v: 20 }], value)
    expect(below.high).toHaveLength(15)
    expect(below.low.map(value)).toEqual([10, 20])
  })

  it("auf dem Median bei gleich großen Gruppen in keiner", () => {
    const split = splitAtMedian(
      items(50, 50, 50, 50, 30, 30, 30, 30, 30, 70, 70, 70, 70, 70),
      value
    )
    expect(split.high.map(value)).toEqual([70, 70, 70, 70, 70])
    expect(split.low.map(value)).toEqual([30, 30, 30, 30, 30])
  })

  it("alle gleich: beide Gruppen leer; ohne Einträge auch", () => {
    expect(splitAtMedian(items(50, 50, 50), value)).toEqual({ high: [], low: [] })
    expect(splitAtMedian([], value)).toEqual({ high: [], low: [] })
  })
})
