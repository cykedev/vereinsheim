import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Missing } from "./Missing"

describe("Missing", () => {
  it("zeigt „–“ und leise daneben den Grund", () => {
    const html = renderToStaticMarkup(createElement(Missing, { kind: "noSeries" }))
    expect(html).toContain('data-missing="noSeries"')
    expect(html).toContain('<span aria-hidden="true">–</span>')
    expect(html).toMatch(/class="text-xs font-normal">noch keine Serie</)
    expect(html).not.toContain("title=")
  })

  it("leise: den Grund nur als Tooltip und für Screenreader", () => {
    const html = renderToStaticMarkup(createElement(Missing, { kind: "noPlace", quiet: true }))
    expect(html).toContain('title="ohne Platz"')
    expect(html).toMatch(/class="sr-only">ohne Platz</)
  })
})
