import { describe, expect, it } from "vitest"

import type { ShotInput } from "../db/cards"
import { blockEnds, startsNewBlock } from "./probe-blocks"

const T0 = Date.UTC(2026, 9, 16, 16, 30)

/** ein Schuss; Lage und Zeit aus `at` (Sekunden nach T0), damit jeder Schuss seinen eigenen Fingerabdruck hat */
function shot(stellung: number, treffer: number, at: number, xUm = at * 10): ShotInput {
  return {
    seq: treffer,
    stellung,
    treffer,
    series: stellung === 0 ? null : 1,
    xUm,
    yUm: -at * 7,
    ring: 9,
    decimalTenths: 95,
    distanceTenthsUm: 12_000,
    innerTen: false,
    displayMode: 1,
    firedAtMs: T0 + at * 1000,
    flags: [],
  }
}

/** `n` Probeschüsse ab Sekunde `from`, Nummern ab 1 */
const probe = (n: number, from: number) =>
  Array.from({ length: n }, (_, i) => shot(0, i + 1, from + i * 40))
const match = (n: number, from: number) =>
  Array.from({ length: n }, (_, i) => shot(1, i + 1, from + i * 40))

describe("startsNewBlock", () => {
  it("Neustart der Probe (SF-72): andere Schüsse unter denselben Nummern beginnen einen neuen Block", () => {
    expect(startsNewBlock(probe(8, 0), probe(5, 1000))).toBe(true)
  })

  it("Übergang zur Wertung (SF-03): die Probe ist weg, der erste Wertungsschuss beginnt einen neuen Block", () => {
    expect(startsNewBlock(probe(5, 0), match(1, 500))).toBe(true)
  })

  it("weitere Probeschüsse oder eine Teilmenge derselben (zerrissene Lesung, SF-71): kein neuer Block", () => {
    const eight = probe(8, 0)
    expect(startsNewBlock(eight.slice(0, 5), eight)).toBe(false)
    expect(startsNewBlock(eight, eight.slice(0, 3))).toBe(false)
  })

  it("ein leerer Stand beginnt keinen Block, eine leere Scheibe ist keiner", () => {
    expect(startsNewBlock(probe(5, 0), [])).toBe(false)
    expect(startsNewBlock([], probe(5, 0))).toBe(false)
  })

  it("eine Scheibe mit Wertung teilt sich nie: auch eine Korrektur der Lage (SF-21) bleibt dieselbe Scheibe", () => {
    const [first] = match(1, 0)
    const corrected = { ...first, xUm: first.xUm! + 500 }
    expect(startsNewBlock([first], [corrected])).toBe(false)
    expect(startsNewBlock(match(3, 0), probe(2, 900))).toBe(false)
  })
})

describe("blockEnds", () => {
  const a = probe(8, 0)
  const b = probe(5, 1000)

  it("je Block der letzte Stand, der zweite ist neu", () => {
    expect(blockEnds(null, [a.slice(0, 4), a, a, b.slice(0, 1), b])).toEqual([
      { index: 2, newBlock: false },
      { index: 4, newBlock: true },
    ])
  })

  it("gegenüber der Scheibe davor: neu, wenn schon der erste Stand einen Block beginnt", () => {
    expect(blockEnds(a, [b])).toEqual([{ index: 0, newBlock: true }])
    expect(blockEnds(a.slice(0, 3), [a])).toEqual([{ index: 0, newBlock: false }])
  })

  it("ohne Scheibe davor ist der erste Block nicht neu; ohne Stände keine Blöcke", () => {
    expect(blockEnds(null, [a])).toEqual([{ index: 0, newBlock: false }])
    expect(blockEnds(a, [])).toEqual([])
  })

  it("Probe, Neustart, Wertung: drei Blöcke", () => {
    const m = match(20, 3000)
    expect(blockEnds(null, [a, b, m.slice(0, 1), m])).toEqual([
      { index: 0, newBlock: false },
      { index: 1, newBlock: true },
      { index: 3, newBlock: true },
    ])
  })
})
