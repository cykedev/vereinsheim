import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { RULER_HINT, RulerMark, RulerReadout, useRuler, ValuesTable } from "./ChartRuler"

function Probe({ preset }: { preset: number | null }) {
  const { index, svgProps } = useRuler([10, 20, 30], 600, preset)
  return h("svg", svgProps, h("text", null, index === null ? "keine" : `Index ${index}`))
}

describe("Lineal als Baustein", () => {
  it("Zeile ohne Wahl: der Hinweis, gemeldet; der Knopf hält nur seinen Platz", () => {
    const html = renderToStaticMarkup(
      h(RulerReadout, { text: null, action: { label: "Auf der Scheibe", onClick: () => {} } })
    )
    // gemeldet wird nur der Text, nicht der Knopf; feste Höhe von zwei Zeilen
    expect(html).toMatch(/^<div data-readout="true" class="grid h-10 /)
    expect(html).toMatch(/<span aria-live="polite" aria-atomic="true"[^>]*>Tippe oder ziehe/)
    expect(html).toContain(RULER_HINT)
    expect(html).toMatch(
      /<button type="button" aria-hidden="true" tabindex="-1" class="[^"]*invisible/
    )
  })

  it("Zeile mit Wahl: die Werte und die Aktion", () => {
    const html = renderToStaticMarkup(
      h(RulerReadout, {
        text: "Schuss 5 · 9,7",
        action: { label: "Auf der Scheibe", onClick: () => {} },
      })
    )
    expect(html).toContain("Schuss 5 · 9,7")
    expect(html).toMatch(/<button type="button"[^>]*>Auf der Scheibe<\/button>/)
    expect(renderToStaticMarkup(h(RulerReadout, { text: "Schuss 5" }))).not.toContain("<button")
  })

  it("Markierung: senkrechte Linie ohne Zeigerereignisse", () => {
    const html = renderToStaticMarkup(
      h("svg", null, h(RulerMark, { x: 100.2, top: 10, bottom: 90 }))
    )
    expect(html).toMatch(
      /<line data-ruler="true" x1="100.5" x2="100.5" y1="10" y2="90"[^>]*pointer-events="none"/
    )
  })

  it("Tabelle: zugeklappt, mit Beschriftung, Kopf und Zeilen", () => {
    const html = renderToStaticMarkup(
      h(ValuesTable, {
        caption: "Wert je Schuss",
        columns: ["Schuss", "Wert"],
        rows: [
          ["1", "9,7"],
          ["2", "10,1"],
        ],
      })
    )
    expect(html).toMatch(/^<details data-values="true"/)
    expect(html).not.toContain("<details open")
    expect(html).toContain("<summary")
    expect(html).toContain("Werte als Tabelle")
    expect(html).toContain('<caption class="sr-only">Wert je Schuss</caption>')
    // die Zusammenfassung nennt die Tabelle, der Scrollbereich ist per Tastatur erreichbar
    expect(html).toContain('<span class="sr-only">: Wert je Schuss</span>')
    expect(html).toMatch(/<div tabindex="0" role="region" aria-label="Wert je Schuss"/)
    expect([...html.matchAll(/<th scope="row"/g)]).toHaveLength(2)
    expect([...html.matchAll(/<th scope="col"/g)]).toHaveLength(2)
    expect([...html.matchAll(/<tr class="border-t/g)]).toHaveLength(2)
  })

  it("Hook: fokussierbar, senkrecht scrollbar, die Vorgabe der Scheibe gilt", () => {
    const html = renderToStaticMarkup(h(Probe, { preset: 1 }))
    expect(html).toContain('tabindex="0"')
    expect(html).toContain("touch-action:pan-y")
    expect(html).toContain("Index 1")
    // als Schieberegler bedienbar (APG): Wert 2 von 3
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('aria-valuemax="3"')
    expect(renderToStaticMarkup(h(Probe, { preset: null }))).toContain("keine")
  })
})

describe("Lineal: Index außerhalb der Werte", () => {
  function Few({ preset }: { preset: number | null }) {
    const { index } = useRuler([10, 20], 600, preset)
    return h("p", null, index === null ? "keine" : `Index ${index}`)
  }

  it("gilt als keine Wahl, statt auf einen fehlenden Wert zu zeigen", () => {
    expect(renderToStaticMarkup(h(Few, { preset: 5 }))).toContain("keine")
    expect(renderToStaticMarkup(h(Few, { preset: 1 }))).toContain("Index 1")
  })
})

describe("Lineal ohne Textauswahl", () => {
  type SvgProps = ReturnType<typeof useRuler>["svgProps"]
  let props: SvgProps | null = null
  function Capture({ onProps }: { onProps: (svgProps: SvgProps) => void }) {
    const { svgProps } = useRuler([10, 20, 30], 600)
    onProps(svgProps)
    return h("svg", svgProps)
  }
  const html = renderToStaticMarkup(
    h(Capture, {
      onProps: (svgProps) => {
        props = svgProps
      },
    })
  )
  const press = (pointerType: string) => {
    const event = {
      button: 0,
      pointerType,
      pointerId: 1,
      clientX: 100,
      preventDefault: vi.fn(),
      currentTarget: {
        focus: vi.fn(),
        setPointerCapture: () => {},
        getBoundingClientRect: () => ({ left: 0, width: 600 }),
      },
    }
    props?.onPointerDown?.(event as never)
    return event
  }

  it("auch mit Präfix für Safari", () => {
    expect(html).toContain("user-select:none")
    expect(html).toContain("-webkit-user-select:none")
  })

  it("die Maus beginnt keine Auswahl und fokussiert das Diagramm selbst; ein Finger scrollt weiter", () => {
    const mouse = press("mouse")
    expect(mouse.preventDefault).toHaveBeenCalled()
    expect(mouse.currentTarget.focus).toHaveBeenCalledWith({ preventScroll: true })
    const touch = press("touch")
    expect(touch.preventDefault).not.toHaveBeenCalled()
    expect(touch.currentTarget.focus).not.toHaveBeenCalled()
  })
})

describe("Lineal mit Höhen: ein Tipp in einen Stapel wählt den getroffenen Wert", () => {
  type SvgProps = ReturnType<typeof useRuler>["svgProps"]
  // drei Werte 0,3 px nebeneinander, untereinander bei y 20, 50, 80; das SVG ist nicht skaliert
  function Capture({
    ys,
    onPick,
    onProps,
  }: {
    ys: readonly number[] | undefined
    onPick: (index: number | null) => void
    onProps: (svgProps: SvgProps) => void
  }) {
    const { svgProps } = useRuler([100, 100.3, 100.6], 600, null, onPick, ys)
    onProps(svgProps)
    return h("svg", svgProps)
  }
  const tap = (ys: readonly number[] | undefined, clientY: number) => {
    let props: SvgProps | null = null
    const picked = vi.fn()
    renderToStaticMarkup(
      h(Capture, {
        ys,
        onPick: picked,
        onProps: (svgProps) => {
          props = svgProps
        },
      })
    )
    const target = {
      focus: () => {},
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600 }),
    }
    const event = { button: 0, pointerType: "touch", pointerId: 1, clientX: 100.5, clientY }
    ;(props as SvgProps | null)?.onPointerDown?.({ ...event, currentTarget: target } as never)
    ;(props as SvgProps | null)?.onPointerUp?.({ ...event, currentTarget: target } as never)
    return picked.mock.calls.at(-1)?.[0]
  }

  it("mit Höhen der nach y nächste, ohne Höhen der nach x nächste", () => {
    expect(tap([20, 50, 80], 52)).toBe(1)
    expect(tap([20, 50, 80], 12)).toBe(0)
    expect(tap(undefined, 52)).toBe(2)
  })
})
