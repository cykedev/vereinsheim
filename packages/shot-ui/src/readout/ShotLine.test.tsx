import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { directionWords, formatValue } from "../format"
import { asOnPrintout } from "../shots"
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
// die Seite gibt die Karte wie am Ausdruck weiter (U4): ohne die Probe
const line = (state: Partial<ViewState> = {}, shots: readonly MetricShot[] = asOnPrintout(CARD)) =>
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
  it("letzter Schuss: Nummer, Wert, Teiler und Abstand in einer Zeile, Werte wie die Ablesung", () => {
    const teiler = formatValue(distanceUm(-4200, -1100) / 10, 1)
    const away = `${formatValue(distanceUm(-4200, -1100) / 1000, 2)} mm`
    // wie die Karte: Abstand zur Mitte statt x/y (Prüfung, Lage 12)
    expect(line()).toBe(`Schuss 3 · 8,7 · Teiler ${teiler} · Abstand zur Mitte ${away}`)
    expect(card()).toContain(`Abstand zur Mitte ${away}`)
    expect(line()).not.toContain(directionWords({ xUm: -4200, yUm: -1100 }))
    expect(card()).toContain(`Teiler ${teiler}`)
    expect(card()).toContain("8,7")
  })

  it("der angetippte Schuss statt des letzten", () => {
    expect(line({ chosen: { index: 0, series: 1 } })).toMatch(/^Schuss 1 · 9,6 · Teiler/)
  })

  it("auch in ganzen Ringen in Zehnteln (Rückmeldung 3), ohne Lage nur Nummer und Wert", () => {
    expect(line({ scoring: "rings" })).toMatch(/^Schuss 3 · 8,7 · Teiler/)
    expect(line({ chosen: { index: 1, series: 1 } })).toBe("Schuss 2 · 0,0 · Fehlschuss")
  })

  it("Innenzehner wie auf der Karte", () => {
    const inner = [...CARD.slice(0, 3), { ...shot("match", -300, -400, 109), innerTen: true }]
    expect(line({}, inner)).toMatch(/^Schuss 3 · 10,9 · Teiler [\d,]+ · .* · Innenzehner$/)
  })

  it("ohne Schuss ein Satz, für Screenreader angesagt", () => {
    expect(line({}, [])).toBe("Noch kein Schuss.")
    expect(
      renderToStaticMarkup(createElement(ShotLine, { shots: CARD, state: initialViewState() }))
    ).toMatch(/^<div role="status" aria-live="polite" aria-label="Ablesung"/)
  })

  it("ein Modell für Karte und Zeile", () => {
    const model = readoutModel(CARD, initialViewState())!
    expect(model.index).toBe(3)
    expect(model.chosen).toBe(false)
    expect(model.label).toBe("3")
  })
})
