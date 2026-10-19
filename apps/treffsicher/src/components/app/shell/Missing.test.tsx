import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Missing } from "./Missing"

describe("Missing", () => {
  it("Strich nur für das Auge, der Grund lesbar für alle", () => {
    const html = renderToStaticMarkup(h(Missing, { kind: "quality" }))
    expect(html).toContain('data-missing="quality"')
    expect(html).toContain('<span aria-hidden="true">–</span>')
    expect(html).toContain(">nicht bewertet</span>")
  })
})
