import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HitLocationVisualization } from "./HitLocationVisualization"

describe("HitLocationVisualization", () => {
  it("zeigt die Lage in Millimetern mit Komma und zwei Stellen", () => {
    const html = renderToStaticMarkup(
      h(HitLocationVisualization, {
        horizontalMm: 3.18,
        horizontalDirection: "RIGHT",
        verticalMm: 1.2,
        verticalDirection: "HIGH",
      })
    )
    expect(html).toContain("→ 3,18 mm")
    expect(html).toContain("↑ 1,20 mm")
    expect(html).toContain("rechts, hoch")
  })
})
