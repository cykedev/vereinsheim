import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ScoringSwitch } from "./ScoringSwitch"

const scoring = (value: "decimal" | "rings", official?: "decimal" | "rings") =>
  renderToStaticMarkup(
    createElement(ScoringSwitch, { scoring: value, official, onChange: () => {} })
  )

describe("ScoringSwitch", () => {
  it("Zehntel oder ganze Ringe als Wahl „Wertung“", () => {
    const html = scoring("rings")
    expect(html).toContain('aria-label="Wertung"')
    expect(html).toMatch(/aria-checked="false"[^>]*>Zehntel</)
    expect(html).toMatch(/aria-checked="true"[^>]*>Ganze Ringe</)
  })

  it("die amtliche Wertung bleibt als Hinweis sichtbar, auch nach dem Umschalten", () => {
    expect(scoring("decimal", "decimal")).toContain("amtlich: Zehntel")
    expect(scoring("decimal", "rings")).toContain("amtlich: ganze Ringe")
    expect(scoring("rings")).not.toContain("amtlich")
  })
})
