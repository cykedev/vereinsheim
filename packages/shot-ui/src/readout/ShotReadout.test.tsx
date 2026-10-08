import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatValue } from "../format"
import { initialViewState, type ViewState } from "../view-state"
import { ShotReadout } from "./ShotReadout"

const shot = (
  kind: "probe" | "match",
  xUm: number | null,
  yUm: number | null,
  tenths: number | null,
  innerTen = false
): MetricShot => ({
  xUm,
  yUm,
  decimalTenths: tenths,
  ring: tenths === null ? null : Math.floor(tenths / 10),
  innerTen,
  firedAtMs: null,
  kind,
  series: kind === "match" ? 1 : null,
})

// eine Probe, dann drei Wertungsschüsse; der letzte ist ein Innenzehner links unten
const CARD = [
  shot("probe", 2500, 1200, 104),
  shot("match", 14000, 0, 96),
  shot("match", null, null, 0),
  shot("match", -300, -400, 109, true),
]

const render = (state: Partial<ViewState> = {}, shots: readonly MetricShot[] = CARD) =>
  renderToStaticMarkup(
    createElement(ShotReadout, { shots, state: { ...initialViewState(), ...state } })
  )

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("ShotReadout: Ablesung des angetippten oder letzten Schusses", () => {
  it("ohne Antippen der letzte Schuss, mit Wert in seiner Ringwert-Farbe", () => {
    const html = render()
    expect(text(html)).toContain("Schuss 3 · letzter Schuss")
    expect(html).toMatch(/style="color:var\(--score-10\)"[^>]*>10,9</)
  })

  it("angetippt: dieser Schuss, Probe mit P", () => {
    expect(text(render({ chosen: { index: 0, series: "probe" } }))).toContain(
      "Probe P1 · angetippt"
    )
  })

  it("die andere Wertung klein daneben", () => {
    expect(text(render())).toContain("Ring 10")
    const rings = text(render({ scoring: "rings" }))
    expect(rings).toMatch(/· letzter Schuss 10 /)
    expect(rings).toContain("10,9 in Zehnteln")
  })

  it("Innenzehner und Fehlschuss benannt", () => {
    expect(text(render())).toContain("Innenzehner")
    expect(text(render({ chosen: { index: 2, series: 1 } }))).toContain("Fehlschuss")
  })

  it("Teiler, Abstand und Lage aus der Lage des Schusses", () => {
    const t = text(render())
    expect(t).toContain(`Teiler ${formatValue(distanceUm(-300, -400) / 10, 1)}`)
    expect(t).toContain("Abstand zur Mitte 0,50 mm")
    expect(t).toContain("x / y −0,30 mm / −0,40 mm")
    expect(text(render({ chosen: { index: 1, series: 1 } }))).toContain("x / y +14,00 mm / 0,00 mm")
  })

  it("ohne Lage keine Angaben zur Lage", () => {
    const t = text(render({ chosen: { index: 2, series: 1 } }))
    expect(t).not.toContain("Teiler")
    expect(t).not.toContain("x / y")
  })

  it("ein Antippen, das nicht mehr passt (andere Karte), zeigt den letzten Schuss", () => {
    expect(text(render({ chosen: { index: 9, series: 1 } }))).toContain("Schuss 3 · letzter Schuss")
  })

  it("ohne Schüsse ein Hinweis; Änderungen werden Screenreadern gemeldet", () => {
    const empty = render({}, [])
    expect(text(empty)).toBe("Noch kein Schuss.")
    expect(render()).toContain('aria-live="polite"')
  })
})
