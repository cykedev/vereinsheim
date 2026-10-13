import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KindToggle } from "./KindToggle"
import { ScoringToggle } from "./ScoringToggle"

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
