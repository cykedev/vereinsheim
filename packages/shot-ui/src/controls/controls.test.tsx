import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KindToggle } from "./KindToggle"
import { ScoringSegment } from "./ScoringSegment"
import { ScoringToggle } from "./ScoringToggle"

describe("ScoringToggle: der Bruch im weichen Kreis", () => {
  const html = (props: Partial<Parameters<typeof ScoringToggle>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(ScoringToggle, { scoring: "decimal", onChange: () => {}, ...props })
    )

  it("Zehntel als Bruch der Schrift (1/10 mit diagonal-fractions), ganze Ringe als 1; Name mit Zustand und Wirkung", () => {
    const decimal = html()
    expect(decimal).toMatch(/<span[^>]*class="[^"]*\bdiagonal-fractions\b[^"]*"[^>]*>1\/10<\/span>/)
    expect(decimal).not.toMatch(/<su[pb]/)
    expect(decimal).toContain('aria-label="Wertung: Zehntel, auf ganze Ringe umstellen"')
    expect(decimal).toContain('title="Zehntel"')
    expect(decimal).toContain('data-scoring="decimal"')
    expect(decimal).toContain("data-scoring-toggle")
    const rings = html({ scoring: "rings" })
    expect(rings).toMatch(/<span[^>]*aria-hidden="true"[^>]*>1<\/span>/)
    expect(rings).toContain('aria-label="Wertung: ganze Ringe, auf Zehntel umstellen"')
  })

  it("die amtliche nennt sich so, gezeigt im Zustand, sonst in der Wirkung; ein eigener Name für einen Teil der Seite", () => {
    expect(html({ scoring: "rings", official: "rings" })).toContain(
      'aria-label="Wertung: ganze Ringe, amtlich, auf Zehntel umstellen"'
    )
    expect(html({ scoring: "rings", official: "rings" })).toContain('title="Ganze Ringe, amtlich"')
    expect(html({ scoring: "decimal", official: "rings" })).toContain(
      'aria-label="Wertung: Zehntel, auf ganze Ringe (amtlich) umstellen"'
    )
    expect(html({ scoring: "decimal", official: "rings" })).toContain('title="Zehntel"')
    expect(html({ label: "Wertung für Ø und Abstand" })).toContain(
      'aria-label="Wertung für Ø und Abstand: Zehntel, auf ganze Ringe umstellen"'
    )
  })

  it("leise: das Zeichen in muted-foreground, mittelstark (eine Randinformation)", () => {
    expect(html()).toMatch(/<span[^>]*class="[^"]*\bfont-medium\b[^"]*\btext-muted-foreground\b/)
    expect(html()).not.toContain("font-semibold")
  })

  it("die 1 kleiner als der Bruch gesetzt, so ruhig wie seine Ziffern (User, 13. Oktober 2026)", () => {
    expect(html({ scoring: "rings" })).toMatch(
      /<span[^>]*class="[^"]*\btext-\[13px\][^"]*"[^>]*>1<\/span>/
    )
    expect(html({ scoring: "rings" })).not.toContain("text-base")
    // tailwind-merge striche `leading-none` hinter einer Schriftgröße
    expect(html({ scoring: "rings" })).toMatch(
      /<span[^>]*class="[^"]*\bleading-none\b[^"]*"[^>]*>1<\/span>/
    )
    expect(html({ scoring: "decimal" })).toMatch(
      /<span[^>]*class="[^"]*\bleading-none\b[^"]*"[^>]*>1\/10<\/span>/
    )
    expect(html({ scoring: "decimal" })).toMatch(
      /<span[^>]*class="[^"]*\btext-base diagonal-fractions\b[^"]*"[^>]*>1\/10<\/span>/
    )
  })

  it("keine Schrift unter text-xs, weder im Bruch noch in der 1", () => {
    expect(html({ scoring: "decimal" })).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
    expect(html({ scoring: "rings" })).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })
})

describe("KindToggle: der Pokal im weichen Kreis", () => {
  const html = (kind: "training" | "competition") =>
    renderToStaticMarkup(createElement(KindToggle, { kind, onChange: () => {} }))

  it("Training gedämpft, Wettkampf in Gold; Name mit Zustand und Wirkung", () => {
    const training = html("training")
    expect(training).toContain('aria-label="Art: Training, auf Wettkampf umstellen"')
    expect(training).toContain('data-kind="training"')
    expect(training).toContain("text-quiet")
    // Training durchgestrichen: der Strich schneidet eine Lücke in den Pokal (Maske), wie die „-off“-Symbole von lucide
    expect(training).toContain("lucide-trophy-off")
    expect(training).toMatch(/<mask id="[^"]+">[\s\S]*<\/mask><g mask="url\(#[^)]+\)">/)
    expect(training).toMatch(/<path d="m2 2 20 20"><\/path><\/svg>/)
    const competition = html("competition")
    expect(competition).toContain('aria-label="Art: Wettkampf, auf Training umstellen"')
    expect(competition).toMatch(/class="[^"]*\bbg-gold-wash\b[^"]*\btext-gold\b/)
    expect(competition).toContain("data-kind-toggle")
    expect(competition).not.toContain("<mask")
  })
})

describe("ScoringSegment: die Wertung als beschriftete Auswahl in einer Filterzeile (User, 13. Oktober 2026)", () => {
  const html = (scoring: "rings" | "decimal") =>
    renderToStaticMarkup(
      createElement(ScoringSegment, {
        scoring,
        prefix: "Ø in",
        label: "Wertung für Ø und Abstand",
        onChange: () => {},
      })
    )

  it("davor der Bezug, dann „Ganze Ringe | Zehntel“, die gezeigte gewählt", () => {
    const rings = html("rings")
    expect(rings).toMatch(
      /^<span data-scoring-segment="rings" class="inline-flex items-center gap-2">/
    )
    expect(rings).toMatch(/<span aria-hidden="true"[^>]*>Ø in<\/span><div role="radiogroup"/)
    expect(rings).toContain('aria-label="Wertung für Ø und Abstand"')
    expect(rings).toMatch(/aria-checked="true"[^>]*>Ganze Ringe<\/button>/)
    expect(rings).toMatch(/aria-checked="false"[^>]*>Zehntel<\/button>/)
    expect(rings.indexOf("Ganze Ringe")).toBeLessThan(rings.indexOf("Zehntel"))
    expect(html("decimal")).toMatch(/aria-checked="true"[^>]*>Zehntel<\/button>/)
  })
})
