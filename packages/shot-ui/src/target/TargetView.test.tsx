import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { initialViewState, type ViewState } from "../view-state"
import { TargetView } from "./TargetView"

const shot = (
  kind: "probe" | "match",
  series: number | null,
  xUm: number,
  yUm: number,
  tenths: number
): MetricShot => ({
  xUm,
  yUm,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind,
  series,
})

// zwei Probeschüsse, Serie 1 mit drei, Serie 2 mit zwei Schuss (LP, Lagen in µm)
const CARD = [
  shot("probe", null, 14000, -9000, 96),
  shot("probe", null, 1000, 2000, 104),
  shot("match", 1, 0, 0, 109),
  shot("match", 1, 2000, 1000, 105),
  shot("match", 1, -1500, 2500, 103),
  shot("match", 2, 3000, -2000, 101),
  shot("match", 2, 2500, -1500, 102),
]

const render = (state: Partial<ViewState> = {}, others?: "dim" | "hide") =>
  renderToStaticMarkup(
    createElement(TargetView, {
      target: LP_10M,
      shots: CARD,
      state: {
        ...initialViewState({ layers: { mpi: true, circle: true, numbers: true, ellipse: true } }),
        ...state,
      },
      others,
    })
  )

/** Folge der Schuss-Beschriftungen (data-shot) in Zeichenreihenfolge */
const shotOrder = (html: string) => [...html.matchAll(/<g data-shot="([^"]+)"/g)].map((m) => m[1])

describe("TargetView: Ebenen", () => {
  it("Scheibe, dann Treffer, dann Überlagerungen", () => {
    const html = render()
    const layers = [...html.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1])
    expect(layers).toEqual(["target", "shots", "overlays"])
  })

  it("jeder Treffer trägt seine Nummer, Probe unter Wertung, sonst Abgabefolge", () => {
    const html = render()
    expect(shotOrder(html)).toEqual(["P1", "P2", "1", "2", "3", "4", "5"])
    // Kreis und Nummer stehen zusammen in der Gruppe des Schusses
    expect(html).toMatch(
      /<g data-shot="2"[^>]*>(?:<title>[^<]*<\/title>)?<circle[^>]*>(?:<\/circle>)?<text data-number="2"[^>]*>2<\/text><\/g>/
    )
  })

  it("Schwerpunkt ganz oben über Streukreis und Ellipse", () => {
    const html = render()
    const overlays = html.slice(html.indexOf('data-layer="overlays"'))
    const parts = [...overlays.matchAll(/data-overlay="([^"]+)"/g)].map((m) => m[1])
    expect(parts).toEqual(["spread", "ellipse", "mpi"])
  })

  it("ohne Schalter keine Nummern", () => {
    const html = renderToStaticMarkup(
      createElement(TargetView, { target: LP_10M, shots: CARD, state: initialViewState() })
    )
    expect(html).not.toContain("<text data-number")
  })
})

describe("TargetView: Auswahl und Antippen", () => {
  it("gewählte Serie normal und oben, die übrigen blass, ohne Nummer und nicht antippbar", () => {
    const html = render({ selection: [2] })
    expect(shotOrder(html)).toEqual(["P1", "P2", "1", "2", "3", "4", "5"])
    for (const label of ["P1", "P2", "1", "2", "3"]) {
      expect(html).toMatch(
        new RegExp(`<g data-shot="${label}" data-faded="true"[^>]*opacity="0.18"`)
      )
      // Ringzahlen tragen auch „1“ bis „8“: Nummern erkennt man an data-number
      expect(html).not.toContain(`data-number="${label}"`)
    }
    expect(html).toMatch(/<g data-shot="4"(?! data-faded)/)
    expect(html).toContain('data-number="4"')
  })

  it("Streukreis und Schwerpunkt rechnen über die Auswahl", () => {
    // Serie 2: Schwerpunkt (2,75 | −1,75) mm, in SVG y nach unten also 1,75
    const html = render({ selection: [2] })
    expect(html).toMatch(/data-overlay="mpi"[^>]*transform="translate\(2\.75 1\.75\)/)
  })

  it("ausgeblendet statt blass: die übrigen fehlen ganz", () => {
    const html = render({ selection: [2] }, "hide")
    expect(shotOrder(html)).toEqual(["4", "5"])
  })

  it("der angetippte Schuss liegt ganz oben, mit Ring", () => {
    const html = render({ chosen: { index: 3, series: 1 } })
    expect(shotOrder(html).at(-1)).toBe("2")
    expect(html).toMatch(/<g data-shot="2" data-chosen="true"/)
    expect(html).toContain('data-ring="chosen"')
  })
})

describe("TargetView: Probe und Scheibe", () => {
  it("Probe hohl; vor der Visierverstellung gestrichelt", () => {
    const html = render({ adjustAfter: [1] })
    expect(html).toMatch(
      /<g data-shot="P1"[^>]*>(?:<title>[^<]*<\/title>)?<circle[^>]*fill="none"[^>]*stroke-dasharray="2 2"/
    )
    expect(html).toMatch(
      /<g data-shot="P2"[^>]*>(?:<title>[^<]*<\/title>)?<circle(?![^>]*stroke-dasharray)[^>]*fill="none"/
    )
  })

  it("Wertung gefüllt in der Ringwert-Farbe, leicht durchscheinend, Rand als Haarlinie", () => {
    const html = render()
    expect(html).toMatch(
      /<g data-shot="1"[^>]*>(?:<title>[^<]*<\/title>)?<circle[^>]*fill="var\(--score-10\)"[^>]*fill-opacity="0.8"[^>]*stroke="var\(--shot-edge\)"[^>]*vector-effect="non-scaling-stroke"/
    )
  })

  it("ein Bild mit Satz für Screenreader", () => {
    expect(render()).toMatch(
      /<svg[^>]*role="img"[^>]*aria-label="Luftpistole 10 m: 5 Wertungsschüsse, 2 Probeschüsse"/
    )
    expect(render({ selection: ["probe", 2] })).toContain("gewählt: Probe, Serie 2")
  })

  it("Luftgewehr: die Zehn ist ein weißer Punkt, LP: der Innenzehner gestrichelt", () => {
    const lg = renderToStaticMarkup(
      createElement(TargetView, { target: LG_10M, shots: [], state: initialViewState() })
    )
    expect(lg).toMatch(/<circle[^>]*r="0.25"[^>]*fill="var\(--paper\)"/)
    expect(render()).toMatch(/<circle[^>]*r="2.5"[^>]*stroke-dasharray="3 3"/)
  })
})
