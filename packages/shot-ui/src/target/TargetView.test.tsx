import { smallestEnclosingCircle } from "@vereinsheim/shot-core/geometry"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { caliberRadius, screenSizes, targetView, unitsPerPixel } from "../geometry"
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
    const html = render({ selection: 2 })
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

  it("blasse Schüsse liegen unter der Auswahl, auch wenn sie später kamen", () => {
    // Serie 1 gewählt: die blassen Schüsse 4 und 5 von Serie 2 rutschen unter 1 bis 3
    expect(shotOrder(render({ selection: 1 }))).toEqual(["P1", "P2", "4", "5", "1", "2", "3"])
  })

  it("Streukreis um die Treffer: durch die Zentren plus halbes Kaliber und 2 px Luft", () => {
    // ohne Messung (Server) rechnet die Scheibe mit 600 px Breite
    const view = targetView(LP_10M)
    const gap = screenSizes(LP_10M, unitsPerPixel(view, 0)).spreadGap
    const centers = smallestEnclosingCircle(
      CARD.filter((s) => s.kind === "match").map((s) => ({ xUm: s.xUm!, yUm: s.yUm! }))
    )
    const r = Number(/data-overlay="spread"[^>]*r="([^"]+)"/.exec(render())?.[1])
    expect(centers).not.toBeNull()
    expect(r).toBeCloseTo(centers!.radiusUm / 1000 + caliberRadius(LP_10M) + gap, 9)
  })

  it("Streukreis und Schwerpunkt rechnen über die Auswahl", () => {
    // Serie 2: Schwerpunkt (2,75 | −1,75) mm, in SVG y nach unten also 1,75
    const html = render({ selection: 2 })
    expect(html).toMatch(/data-overlay="mpi"[^>]*transform="translate\(2\.75 1\.75\)/)
  })

  it("ausgeblendet statt blass: die übrigen fehlen ganz", () => {
    const html = render({ selection: 2 }, "hide")
    expect(shotOrder(html)).toEqual(["4", "5"])
  })

  it("der angetippte Schuss liegt ganz oben, mit Ring", () => {
    const html = render({ chosen: { index: 3, series: 1 } })
    expect(shotOrder(html).at(-1)).toBe("2")
    expect(html).toMatch(/<g data-shot="2" data-chosen="true"/)
    expect(html).toContain('data-ring="chosen"')
  })

  it("der angetippte Schuss trägt seine Nummer auch ohne die Ebene „Nummern“", () => {
    const html = render({
      chosen: { index: 3, series: 1 },
      layers: { mpi: true, circle: true, numbers: false, ellipse: false },
    })
    expect([...html.matchAll(/data-number="([^"]+)"/g)].map((m) => m[1])).toEqual(["2"])
  })

  it("hohle Treffer sind auf der ganzen Fläche antippbar, blasse gar nicht", () => {
    // fill="none" nimmt sonst nur den Rand als Trefferfläche
    const html = render({ selection: "probe" })
    expect(html).toMatch(
      /<g data-shot="P1"[^>]*>(?:<title>[^<]*<\/title>)?<circle[^>]*fill="none"[^>]*pointer-events="visible"/
    )
    expect(html).toMatch(/<g data-shot="1" data-faded="true"[^>]*pointer-events="none"/)
    expect(html).not.toMatch(
      /<g data-shot="1" data-faded="true"[^>]*>(?:<title>[^<]*<\/title>)?<circle[^>]*pointer-events="visible"/
    )
  })

  it("ein Wertungsschuss ohne Serie gehört zu keiner gewählten Serie", () => {
    const html = renderToStaticMarkup(
      createElement(TargetView, {
        target: LP_10M,
        shots: [...CARD, shot("match", null, 500, 500, 104)],
        state: initialViewState({ selection: 1 }),
      })
    )
    expect(html).toMatch(/<g data-shot="6" data-faded="true"/)
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

  it("Farben nur aus den Design-2-Tokens, keine festen Werte", () => {
    const html = render({ chosen: { index: 3, series: 1 } })
    expect(html).not.toMatch(/(?:fill|stroke)="(?:#|rgb)/)
    expect(html).toContain('fill="var(--shot-number)"')
    expect(html).toContain('stroke="var(--shot-number-halo)"')
    expect(html).toContain('fill="var(--mpi-light)"')
    expect(html).toContain('fill="var(--mpi-dark)"')
  })

  it("ein Bild mit Satz für Screenreader", () => {
    expect(render()).toMatch(
      /<svg[^>]*role="img"[^>]*aria-label="Luftpistole 10 m: 5 Wertungsschüsse, 2 Probeschüsse"/
    )
    expect(render({ selection: 2 })).toContain("gewählt: Serie 2")
    expect(render({ selection: "probe" })).toContain("gewählt: Probe")
  })

  it("Luftgewehr: die Zehn ist ein weißer Punkt, LP: der Innenzehner gestrichelt", () => {
    const lg = renderToStaticMarkup(
      createElement(TargetView, { target: LG_10M, shots: [], state: initialViewState() })
    )
    expect(lg).toMatch(/<circle[^>]*r="0.25"[^>]*fill="var\(--paper\)"/)
    expect(render()).toMatch(/<circle[^>]*r="2.5"[^>]*stroke-dasharray="3 3"/)
  })
})
