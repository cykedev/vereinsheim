import { describe, expect, it } from "vitest"

import { initialViewState, isSelected, viewReducer, type ViewState } from "./view-state"

const start = initialViewState()

describe("Auswahl: eine Serie oder alle", () => {
  it("Tippen wählt genau diese Serie, eine andere wechselt, dieselbe noch einmal heißt wieder „alle“", () => {
    let s = viewReducer(start, { type: "select", series: 2 })
    expect(s.selection).toBe(2)
    s = viewReducer(s, { type: "select", series: 3 })
    expect(s.selection).toBe(3)
    s = viewReducer(s, { type: "select", series: 3 })
    expect(s.selection).toBe("all")
  })

  it("„Alle“ setzt zurück", () => {
    const s = viewReducer(viewReducer(start, { type: "select", series: 2 }), {
      type: "selectWhole",
      whole: "all",
    })
    expect(s.selection).toBe("all")
  })

  it("isSelected: „alle“ enthält jede Serie, sonst nur die gewählte", () => {
    expect(isSelected("all", 3)).toBe(true)
    expect(isSelected(2, 2)).toBe(true)
    expect(isSelected(2, 3)).toBe(false)
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
    expect(viewReducer(own, { type: "selectWhole", whole: "all" }).chosen).toEqual({
      index: 5,
      series: 2,
    })
  })
})

describe("Schuss zeigen (aus dem Lineal)", () => {
  it("wählt ohne Umschalten: ein schon gewählter Schuss bleibt gewählt", () => {
    let s = viewReducer(start, { type: "show", shot: 4, series: 1 })
    expect(s.chosen).toEqual({ index: 4, series: 1 })
    s = viewReducer(s, { type: "show", shot: 4, series: 1 })
    expect(s.chosen).toEqual({ index: 4, series: 1 })
  })

  it("liegt der Schuss außerhalb der Auswahl, gilt wieder die ganze Scheibe, damit er zu sehen ist", () => {
    let s = viewReducer(start, { type: "select", series: 1 })
    expect(s.selection).toBe(1)
    s = viewReducer(s, { type: "show", shot: 34, series: 4 })
    expect(s.selection).toBe("all")
    expect(s.chosen).toEqual({ index: 34, series: 4 })
    // in der Auswahl bleibt sie, wie sie ist
    const same = viewReducer(viewReducer(start, { type: "select", series: 1 }), {
      type: "show",
      shot: 3,
      series: 1,
    })
    expect(same.selection).toBe(1)
  })
})

describe("Ausschnitt, Ebenen, Wertung", () => {
  it("Schalter wirken nur auf ihre Ebene", () => {
    const s = viewReducer(start, { type: "toggle", layer: "numbers" })
    expect(s.layers).toEqual({ ...start.layers, numbers: !start.layers.numbers })
  })

  it("gemerkte Ebenen übernehmen: nur die Ebenen, gleiche lassen den Zustand stehen", () => {
    const chosen: ViewState = viewReducer(start, { type: "select", series: 2 })
    const layers = { mpi: false, circle: true, numbers: true, ellipse: true }
    const s = viewReducer(chosen, { type: "setLayers", layers })
    expect(s.layers).toEqual(layers)
    expect({ ...s, layers: chosen.layers }).toEqual(chosen)
    expect(viewReducer(s, { type: "setLayers", layers: { ...layers } })).toBe(s)
  })

  it("Ausschnitt und Wertung", () => {
    expect(viewReducer(start, { type: "setView", view: "group" }).view).toBe("group")
    expect(viewReducer(start, { type: "setScoring", scoring: "rings" }).scoring).toBe("rings")
  })

  it("neue Scheibe: alles zurück bis auf Wertung, Ebenen und Ausschnitt", () => {
    let s: ViewState = viewReducer(start, { type: "select", series: 2 })
    s = viewReducer(s, { type: "setScoring", scoring: "rings" })
    s = viewReducer(s, { type: "setView", view: "group" })
    s = viewReducer(s, { type: "toggle", layer: "numbers" })
    s = viewReducer(s, { type: "reset" })
    expect(s.selection).toBe("all")
    expect(s.chosen).toBeNull()
    expect(s.view).toBe("group")
    expect(s.scoring).toBe("rings")
    expect(s.layers.numbers).toBe(!start.layers.numbers)
  })

  it("verändert den alten Zustand nicht", () => {
    const before = JSON.stringify(start)
    viewReducer(start, { type: "select", series: 1 })
    viewReducer(start, { type: "toggle", layer: "mpi" })
    expect(JSON.stringify(start)).toBe(before)
  })
})
