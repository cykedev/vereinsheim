import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KindSwitch } from "./KindSwitch"
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

  it("ein eigener Name, wo der Schalter nur einen Teil der Seite umstellt", () => {
    const html = renderToStaticMarkup(
      createElement(ScoringSwitch, {
        scoring: "rings",
        label: "Wertung für Ø und Abstand",
        onChange: () => {},
      })
    )
    expect(html).toContain('aria-label="Wertung für Ø und Abstand"')
  })

  it("die amtliche Wertung bleibt als Hinweis sichtbar, auch nach dem Umschalten", () => {
    expect(scoring("decimal", "decimal")).toContain("amtlich: Zehntel")
    expect(scoring("decimal", "rings")).toContain("amtlich: ganze Ringe")
    expect(scoring("rings")).not.toContain("amtlich")
  })
})

describe("KindSwitch", () => {
  it("Training oder Wettkampf als Wahl „Art“", () => {
    const html = renderToStaticMarkup(
      createElement(KindSwitch, { kind: "competition", onChange: () => {} })
    )
    expect(html).toContain('aria-label="Art"')
    expect(html).toMatch(/aria-checked="false"[^>]*>Training</)
    expect(html).toMatch(/aria-checked="true"[^>]*>Wettkampf</)
    // wie die Wertung in einem Flex-Rahmen, sonst zöge ein Raster das Segment auf die ganze Breite
    expect(html).toMatch(/^<div class="flex flex-wrap items-center gap-2"><div role="radiogroup"/)
  })
})
