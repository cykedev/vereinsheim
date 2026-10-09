import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { targetView } from "../geometry"
import { initialViewState, type ViewState } from "../view-state"
import { TargetControls, type Others } from "./TargetControls"

const noop = () => {}
const render = (state: ViewState, others: Others = "dim") =>
  renderToStaticMarkup(
    createElement(TargetControls, {
      state,
      others,
      onToggle: noop,
      onView: noop,
      onOthers: noop,
      onHelp: noop,
    })
  )
const base = initialViewState({ selection: "all" })
/** die Knöpfe in Reihenfolge des Markups: Name und gedrückt */
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-label="([^"]+)"(?: aria-pressed="(true|false)")?/g)].map(
    ([, label, pressed]) => `${label}${pressed === undefined ? "" : `=${pressed}`}`
  )

describe("TargetControls", () => {
  it("vier Ecken: Ausschnitt und Übrige, Hilfe, Schwerpunkt und Streukreis, Ellipse und Nummern", () => {
    const html = render(base)
    for (const corner of ["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "right-2 bottom-2"])
      expect(html).toContain(corner)
    expect(buttons(html)).toEqual([
      "Auf Gruppe zoomen=false",
      "Übrige Schüsse blass zeigen=true",
      "Erklärung: Trefferbild",
      "Schwerpunkt=true",
      "Streukreis=true",
      "Vertrauensellipse=false",
      "Nummern=false",
    ])
  })

  it("zeigt den Zustand: Gruppe, Übrige aus, Ebenen", () => {
    const state: ViewState = {
      ...base,
      view: "group",
      layers: { mpi: false, circle: false, numbers: true, ellipse: true },
    }
    expect(buttons(render(state, "hide"))).toEqual([
      "Auf Gruppe zoomen=true",
      "Übrige Schüsse blass zeigen=false",
      "Erklärung: Trefferbild",
      "Schwerpunkt=false",
      "Streukreis=false",
      "Vertrauensellipse=true",
      "Nummern=true",
    ])
  })

  it("das „?“ führt zur Erklärung der Scheibe, die Ebene darunter bleibt antippbar", () => {
    const html = render(base)
    expect(html).toContain('data-help="trefferbild"')
    expect(html).toMatch(
      /^<div role="group" aria-label="Ansicht der Scheibe" class="pointer-events-none/
    )
    expect(html.match(/pointer-events-auto/g)).toHaveLength(7)
  })

  it("lässt den äußeren Ring ab 290 px Kastenbreite frei (zwei Knöpfe zu 28 px je Ecke)", () => {
    // innere Ecke des zweiten Knopfs: 8 Rand + 28 + 4 Lücke + 28 entlang der Kante, 8 + 28 quer
    const [along, across] = [68, 36]
    for (const target of [LP_10M, LG_10M]) {
      const view = targetView(target)
      const ringPx = (box: number) => ((target.ringRadiiUm[0] / 1000) * box) / view.w
      const gap = (box: number) => Math.hypot(box / 2 - along, box / 2 - across) - ringPx(box)
      expect(gap(290)).toBeGreaterThan(0)
    }
    // knapp: bei der Luftpistole reicht der Ring bei 280 px schon unter die Knöpfe
    const lp = targetView(LP_10M)
    const lpRing = (LP_10M.ringRadiiUm[0] / 1000) * (280 / lp.w)
    expect(Math.hypot(140 - along, 140 - across)).toBeLessThan(lpRing)
  })
})
