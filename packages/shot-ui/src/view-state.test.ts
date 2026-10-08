import { describe, expect, it } from "vitest"

import { initialViewState, isSelected, viewReducer, type ViewState } from "./view-state"

const start = initialViewState()

describe("Auswahl: eine Serie oder alle (Wunsch des Users, 8. Oktober 2026)", () => {
  it("Tippen wählt genau diese Serie, eine andere wechselt, dieselbe noch einmal heißt wieder „alle“", () => {
    let s = viewReducer(start, { type: "select", series: 2 })
    expect(s.selection).toBe(2)
    s = viewReducer(s, { type: "select", series: 3 })
    expect(s.selection).toBe(3)
    s = viewReducer(s, { type: "select", series: 3 })
    expect(s.selection).toBe("all")
  })

  it("die Probe ist wählbar wie eine Serie", () => {
    expect(viewReducer(start, { type: "select", series: "probe" }).selection).toBe("probe")
  })

  it("„Alle“ setzt zurück", () => {
    const s = viewReducer(viewReducer(start, { type: "select", series: 2 }), { type: "selectAll" })
    expect(s.selection).toBe("all")
  })

  it("isSelected: „alle“ enthält jede Serie und die Probe, sonst nur die gewählte", () => {
    expect(isSelected("all", 3)).toBe(true)
    expect(isSelected("all", "probe")).toBe(true)
    expect(isSelected(2, 2)).toBe(true)
    expect(isSelected(2, 3)).toBe(false)
    expect(isSelected(2, "probe")).toBe(false)
    // Wertung ohne Serie: nur in „alle“
    expect(isSelected("all", null)).toBe(true)
    expect(isSelected(1, null)).toBe(false)
  })
})

describe("Antippen eines Schusses", () => {
  it("wählt den Schuss, ein zweites Tippen nimmt ihn zurück", () => {
    let s = viewReducer(start, { type: "choose", shot: 5, series: 2 })
    expect(s.chosen).toEqual({ index: 5, series: 2 })
    s = viewReducer(s, { type: "choose", shot: 7, series: 2 })
    expect(s.chosen).toEqual({ index: 7, series: 2 })
    s = viewReducer(s, { type: "choose", shot: 7, series: 2 })
    expect(s.chosen).toBeNull()
  })

  it("fällt der Schuss aus der Auswahl, ist er nicht mehr gewählt", () => {
    const chosen = viewReducer(start, { type: "choose", shot: 5, series: 2 })
    expect(viewReducer(chosen, { type: "select", series: 3 }).chosen).toBeNull()
    // seine eigene Serie gewählt: er bleibt, und mit „alle“ ebenso
    const own = viewReducer(chosen, { type: "select", series: 2 })
    expect(own.chosen).toEqual({ index: 5, series: 2 })
    expect(viewReducer(own, { type: "selectAll" }).chosen).toEqual({ index: 5, series: 2 })
  })
})

describe("Ausschnitt, Ebenen, Wertung, Visier", () => {
  it("Schalter wirken nur auf ihre Ebene", () => {
    const s = viewReducer(start, { type: "toggle", layer: "numbers" })
    expect(s.layers).toEqual({ ...start.layers, numbers: !start.layers.numbers })
  })

  it("Ausschnitt und Wertung", () => {
    expect(viewReducer(start, { type: "setView", view: "group" }).view).toBe("group")
    expect(viewReducer(start, { type: "setScoring", scoring: "rings" }).scoring).toBe("rings")
  })

  it("Visier verstellt nach einem Probeschuss: an und aus, aufsteigend", () => {
    let s = viewReducer(start, { type: "toggleAdjust", after: 6 })
    s = viewReducer(s, { type: "toggleAdjust", after: 4 })
    expect(s.adjustAfter).toEqual([4, 6])
    s = viewReducer(s, { type: "toggleAdjust", after: 6 })
    expect(s.adjustAfter).toEqual([4])
  })

  it("neue Scheibe: alles zurück bis auf Wertung und Ebenen, Verstellungen aus den Daten", () => {
    let s: ViewState = viewReducer(start, { type: "select", series: 2 })
    s = viewReducer(s, { type: "setScoring", scoring: "rings" })
    s = viewReducer(s, { type: "toggle", layer: "numbers" })
    s = viewReducer(s, { type: "reset", adjustAfter: [4] })
    expect(s.selection).toBe("all")
    expect(s.chosen).toBeNull()
    expect(s.view).toBe("target")
    expect(s.adjustAfter).toEqual([4])
    expect(s.scoring).toBe("rings")
    expect(s.layers.numbers).toBe(!start.layers.numbers)
  })

  it("verändert den alten Zustand nicht", () => {
    const before = JSON.stringify(start)
    viewReducer(start, { type: "select", series: 1 })
    viewReducer(start, { type: "toggleAdjust", after: 2 })
    expect(JSON.stringify(start)).toBe(before)
  })
})
