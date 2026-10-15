import { describe, expect, it } from "vitest"

import { layerOrder } from "./layers"

const m = { kind: "match" as const }

describe("layerOrder: Zeichenreihenfolge der Treffer (jeder mit seiner Nummer)", () => {
  it("in Abgabefolge (keine Probe neben Wertung)", () => {
    expect(layerOrder([m, m, m, m])).toEqual([0, 1, 2, 3])
  })

  it("der gewählte Schuss liegt ganz oben", () => {
    expect(layerOrder([m, m, m, m], { chosen: 1 })).toEqual([0, 2, 3, 1])
    expect(layerOrder([m, m, m, m], { chosen: null })).toEqual([0, 1, 2, 3])
  })

  it("blasse Schüsse außerhalb der Auswahl liegen unter den gewählten", () => {
    const selected = (i: number) => i === 0 || i === 3
    expect(layerOrder([m, m, m, m], { selected })).toEqual([1, 2, 0, 3])
    expect(layerOrder([m, m, m, m], { selected, chosen: 0 })).toEqual([1, 2, 3, 0])
  })

  it("jeder Schuss genau einmal", () => {
    const order = layerOrder([m, m, m, m, m, m], { chosen: 2, selected: (i) => i % 2 === 0 })
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
