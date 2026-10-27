import { describe, expect, it } from "vitest"

import { printedShotsFit, type PrintedShot } from "./print-check"

const wertung = (decimalTenths: (number | null)[], rings?: number[]): PrintedShot[] =>
  decimalTenths.map((v, i) => ({
    stellung: 1,
    treffer: i + 1,
    ring: rings?.[i] ?? (v === null ? null : Math.min(10, Math.floor(v / 10))),
    decimalTenths: v,
  }))
const probe = (decimalTenths: number[]): PrintedShot[] =>
  wertung(decimalTenths).map((shot) => ({ ...shot, stellung: 0 }))

describe("printedShotsFit", () => {
  const raw = [...probe([88, 95]), ...wertung([101, 97, 104, 92])]

  it("ohne Schüsse am Ausdruck gilt nur die Druckzeit", () => {
    expect(printedShotsFit([], raw)).toBe(true)
  })

  it("dieselben Zehntel: passt, auch als Zwischenausdruck", () => {
    expect(printedShotsFit(wertung([101, 97, 104, 92]), raw)).toBe(true)
    expect(printedShotsFit(wertung([101, 97]), raw)).toBe(true)
    expect(printedShotsFit(probe([88, 95]), raw)).toBe(true)
  })

  it("ein Zehntel anders: passt nicht", () => {
    expect(printedShotsFit(wertung([101, 97, 105, 92]), raw)).toBe(false)
  })

  it("mehr Schüsse als die Rohdaten: passt nicht", () => {
    expect(printedShotsFit(wertung([101, 97, 104, 92, 99]), raw)).toBe(false)
  })

  it("andere Art: Probe gegen Wertung passt nicht", () => {
    expect(printedShotsFit(probe([101, 97]), raw)).toBe(false)
    expect(printedShotsFit(wertung([88]), probe([88]))).toBe(false)
  })

  it("ohne Zehntel am Ausdruck zählt der Ring", () => {
    expect(printedShotsFit(wertung([null, null], [10, 9]), raw)).toBe(true)
    expect(printedShotsFit(wertung([null, null], [10, 10]), raw)).toBe(false)
  })

  it("Rohdaten ohne Zehntel: der Ring zählt", () => {
    const rings = wertung([null, null], [10, 9])
    expect(printedShotsFit(wertung([101, 97]), rings)).toBe(true)
    expect(printedShotsFit(wertung([101, 101]), rings)).toBe(false)
  })

  it("Reihenfolge nach Nummer, nicht nach Liste", () => {
    const shuffled = [...raw].reverse()
    expect(printedShotsFit(wertung([101, 97]), shuffled)).toBe(true)
  })
})
