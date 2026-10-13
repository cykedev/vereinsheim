import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KindSwitch } from "./KindSwitch"
import { KindToggle } from "./KindToggle"
import { ScoringToggle } from "./ScoringToggle"
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

describe("ScoringToggle: der Bruch im weichen Kreis", () => {
  const html = (props: Partial<Parameters<typeof ScoringToggle>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(ScoringToggle, { scoring: "decimal", onChange: () => {}, ...props })
    )

  it("Zehntel als ¹⁄₁₀, ganze Ringe als ¹⁄₁; Name mit Zustand und Wirkung", () => {
    const decimal = html()
    expect(decimal).toMatch(/<sup[^>]*>1<\/sup>⁄<sub[^>]*>10<\/sub>/)
    expect(decimal).toContain('aria-label="Wertung: Zehntel, auf ganze Ringe umstellen"')
    expect(decimal).toContain('title="Zehntel"')
    expect(decimal).toContain('data-scoring="decimal"')
    expect(decimal).toContain("data-scoring-toggle")
    const rings = html({ scoring: "rings" })
    expect(rings).toMatch(/<sup[^>]*>1<\/sup>⁄<sub[^>]*>1<\/sub>/)
    expect(rings).toContain('aria-label="Wertung: ganze Ringe, auf Zehntel umstellen"')
  })

  it("die amtliche nennt sich so, nur wenn sie gezeigt ist; ein eigener Name für einen Teil der Seite", () => {
    expect(html({ scoring: "rings", official: "rings" })).toContain(
      'aria-label="Wertung: ganze Ringe, amtlich, auf Zehntel umstellen"'
    )
    expect(html({ scoring: "rings", official: "rings" })).toContain('title="Ganze Ringe, amtlich"')
    expect(html({ scoring: "decimal", official: "rings" })).not.toContain("amtlich")
    expect(html({ label: "Wertung für Ø und Abstand" })).toContain(
      'aria-label="Wertung für Ø und Abstand: Zehntel, auf ganze Ringe umstellen"'
    )
  })

  it("keine Schrift unter text-xs im Bruch", () => {
    expect(html()).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })
})

describe("KindToggle: der Pokal im weichen Kreis", () => {
  const html = (kind: "training" | "competition") =>
    renderToStaticMarkup(createElement(KindToggle, { kind, onChange: () => {} }))

  it("Training gedämpft, Wettkampf in Gold; Name mit Zustand und Wirkung", () => {
    const training = html("training")
    expect(training).toContain('aria-label="Art: Training, auf Wettkampf umstellen"')
    expect(training).toContain('data-kind="training"')
    expect(training).toContain("text-muted-foreground")
    expect(training).toContain("lucide-trophy")
    const competition = html("competition")
    expect(competition).toContain('aria-label="Art: Wettkampf, auf Training umstellen"')
    expect(competition).toMatch(/class="[^"]*\bbg-warning-wash\b[^"]*\btext-warning\b/)
    expect(competition).toContain("data-kind-toggle")
  })
})
