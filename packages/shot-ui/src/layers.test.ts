import { describe, expect, it } from "vitest"

import { layerOrder } from "./layers"

const m = { kind: "match" as const }
const p = { kind: "probe" as const }

describe("layerOrder: Zeichenreihenfolge der Treffer (jeder mit seiner Nummer)", () => {
  it("Probe unter Wertung, sonst in Abgabefolge", () => {
    expect(layerOrder([m, p, m, p])).toEqual([1, 3, 0, 2])
  })

  it("der gewählte Schuss liegt ganz oben", () => {
    expect(layerOrder([m, p, m, p], { chosen: 1 })).toEqual([3, 0, 2, 1])
    expect(layerOrder([m, p, m, p], { chosen: null })).toEqual([1, 3, 0, 2])
  })

  it("blasse Schüsse außerhalb der Auswahl liegen unter den gewählten", () => {
    // gewählt sind Schuss 0 und die Probe 3; blass bleiben 1 (Probe) und 2
    const selected = (i: number) => i === 0 || i === 3
    expect(layerOrder([m, p, m, p], { selected })).toEqual([1, 2, 3, 0])
    expect(layerOrder([m, p, m, p], { selected, chosen: 0 })).toEqual([1, 2, 3, 0])
  })

  it("jeder Schuss genau einmal", () => {
    const order = layerOrder([m, m, p, m, p, m], { chosen: 2, selected: (i) => i % 2 === 0 })
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
