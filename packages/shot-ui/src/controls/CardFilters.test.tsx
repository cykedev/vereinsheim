import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardFilters } from "./CardFilters"

const render = (families: number, kind: "all" | "training" | "competition" = "all") =>
  renderToStaticMarkup(
    h(CardFilters, {
      family: "lg-freihand",
      families: [
        { value: "lg-freihand", label: "Luftgewehr" },
        { value: "lp-auflage", label: "Luftpistole Auflage" },
      ].slice(0, families),
      kind,
      onFamily: () => {},
      onKind: () => {},
    })
  )

describe("Familie und Art (Plan N2, D7)", () => {
  it("ohne `onKind` keine Art (im Fortschritt steht sie im Blatt „Filter“, U2)", () => {
    const html = renderToStaticMarkup(
      h(CardFilters, {
        family: "lg-freihand",
        families: [
          { value: "lg-freihand", label: "Luftgewehr" },
          { value: "lp-auflage", label: "Luftpistole Auflage" },
        ],
        onFamily: () => {},
      })
    )
    expect(html).toContain('aria-label="Familie"')
    expect(html).not.toContain('aria-label="Art"')
  })

  it("erst ab zwei Familien ein Umschalter „Familie“; mit `onKind` die Art", () => {
    expect(render(1)).not.toContain('aria-label="Familie"')
    expect(render(2)).toContain('aria-label="Familie"')
    expect(render(2)).toContain("Luftpistole Auflage")
    for (const label of ["Alle", "Training", "Wettkampf"]) expect(render(1)).toContain(`>${label}<`)
  })

  it("die gewählte Art ist gedrückt", () => {
    expect(render(1, "competition")).toMatch(/aria-checked="true"[^>]*>Wettkampf</)
  })
})
