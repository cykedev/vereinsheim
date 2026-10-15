import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatValue } from "../format"
import { asOnPrintout } from "../shots"
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

// die Seite gibt die Karte wie am Ausdruck weiter (U4): ohne die Probe
const render = (
  state: Partial<ViewState> = {},
  shots: readonly MetricShot[] = asOnPrintout(CARD)
) =>
  renderToStaticMarkup(
    createElement(ShotReadout, { shots, state: { ...initialViewState(), ...state } })
  )

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("ShotReadout: Ablesung des angetippten oder letzten Schusses", () => {
  it("ohne Antippen der letzte Schuss; der Wert in Schriftfarbe, die Ringwert-Farbe als Punkt", () => {
    const html = render()
    expect(text(html)).toContain("Schuss 3 · letzter Schuss")
    // Gold und Türkis hätten als Schrift auf Weiß zu wenig Kontrast
    expect(html).toMatch(
      /<span aria-hidden="true"[^>]*style="background:var\(--score-10\)"[\s\S]*?>10,9</
    )
    expect(html).not.toContain("color:var(--score")
    // kein hohler Punkt mehr: eine Probe neben Wertung gibt es nicht (U4)
    expect(html).not.toContain("box-shadow")
  })

  it("angetippt: dieser Schuss", () => {
    expect(text(render({ chosen: { index: 0, series: 1 } }))).toContain("Schuss 1 · angetippt")
  })

  it("der Wert immer in Zehnteln, klein daneben der Ring (Rückmeldung 3)", () => {
    for (const scoring of ["decimal", "rings"] as const) {
      const t = text(render({ scoring }))
      expect(t).toMatch(/· letzter Schuss 10,9 /)
      expect(t).toContain("Ring 10")
      expect(t).not.toContain("in Zehnteln")
    }
  })

  it("Innenzehner und Fehlschuss benannt", () => {
    expect(text(render())).toContain("Innenzehner")
    expect(text(render({ chosen: { index: 1, series: 1 } }))).toContain("Fehlschuss")
  })

  it("Teiler und Abstand aus der Lage des Schusses, ohne x/y (User, 8. Oktober 2026)", () => {
    const t = text(render())
    expect(t).toContain(`Teiler ${formatValue(distanceUm(-300, -400) / 10, 1)}`)
    expect(t).toContain("Abstand zur Mitte 0,50 mm")
    expect(t).not.toContain("x / y")
    expect(text(render({ chosen: { index: 0, series: 1 } }))).toContain(
      "Abstand zur Mitte 14,00 mm"
    )
  })

  it("Teiler und Abstand wie der Fachkern: gemessen vor der Lage, verdächtig ohne Angaben", () => {
    const measured = { ...CARD[3], xUm: 0, yUm: 3318, distanceUm: 3317 }
    const t = text(render({}, [CARD[0], measured]))
    expect(t).toContain("Teiler 331,7")
    expect(t).toContain("Abstand zur Mitte 3,32 mm")
    const pdfOnly = text(render({}, [{ ...CARD[3], xUm: null, yUm: null, distanceUm: 5000 }]))
    expect(pdfOnly).toContain("Teiler 500,0")
    const placeholder = text(render({}, [{ ...CARD[3], xUm: 0, yUm: 0, flags: ["verdaechtig"] }]))
    expect(placeholder).not.toContain("Teiler")
    expect(placeholder).not.toContain("Abstand")
  })

  it("ohne Lage keine Angaben zur Lage", () => {
    const t = text(render({ chosen: { index: 1, series: 1 } }))
    expect(t).not.toContain("Teiler")
    expect(t).not.toContain("Abstand")
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
