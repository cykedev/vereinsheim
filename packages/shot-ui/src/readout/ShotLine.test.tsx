import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { directionWords, formatValue } from "../format"
import { initialViewState, type ViewState } from "../view-state"
import { readoutModel } from "./readout"
import { ShotLine } from "./ShotLine"
import { ShotReadout } from "./ShotReadout"

const shot = (
  kind: "probe" | "match",
  xUm: number | null,
  yUm: number | null,
  tenths: number | null
): MetricShot => ({
  xUm,
  yUm,
  decimalTenths: tenths,
  ring: tenths === null ? null : Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind,
  series: kind === "match" ? 1 : null,
})

const CARD = [
  shot("probe", 2500, 1200, 104),
  shot("match", 14000, 0, 96),
  shot("match", null, null, 0),
  shot("match", -4200, -1100, 87),
]

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
const line = (state: Partial<ViewState> = {}, shots: readonly MetricShot[] = CARD) =>
  text(
    renderToStaticMarkup(
      createElement(ShotLine, { shots, state: { ...initialViewState(), ...state } })
    )
  )
const card = (state: Partial<ViewState> = {}) =>
  text(
    renderToStaticMarkup(
      createElement(ShotReadout, { shots: CARD, state: { ...initialViewState(), ...state } })
    )
  )

describe("Ablesezeile (D2)", () => {
  it("letzter Schuss: Nummer, Wert, Teiler und Lage in einer Zeile, Werte wie die Ablesung", () => {
    const teiler = formatValue(distanceUm(-4200, -1100) / 10, 1)
    expect(line()).toBe(
      `Schuss 3 · 8,7 · Teiler ${teiler} · ${directionWords({ xUm: -4200, yUm: -1100 })}`
    )
    expect(card()).toContain(`Teiler ${teiler}`)
    expect(card()).toContain("8,7")
  })

  it("der angetippte Schuss statt des letzten, die Probe mit P", () => {
    expect(line({ chosen: { index: 0, series: "probe" } })).toMatch(/^Probe P1 · 10,4 · Teiler/)
  })

  it("in ganzen Ringen der Ring, ohne Lage nur Nummer und Wert", () => {
    expect(line({ scoring: "rings" })).toMatch(/^Schuss 3 · 8 · Teiler/)
    expect(line({ chosen: { index: 2, series: 1 } })).toBe("Schuss 2 · 0,0")
  })

  it("ohne Schuss ein Satz, für Screenreader angesagt", () => {
    expect(line({}, [])).toBe("Noch kein Schuss.")
    expect(
      renderToStaticMarkup(createElement(ShotLine, { shots: CARD, state: initialViewState() }))
    ).toContain('aria-live="polite"')
  })

  it("ein Modell für Karte und Zeile", () => {
    const model = readoutModel(CARD, initialViewState())!
    expect(model.index).toBe(3)
    expect(model.chosen).toBe(false)
    expect(model.label).toBe("3")
  })
})
