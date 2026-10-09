import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { FormStrip } from "./FormStrip"

const strip = [8.7, 9.1, 8.9, 9.0, 8.8, 8.94, 9.25].map((value, i) => ({
  id: `c${i}`,
  value,
  tonight: i >= 5,
}))

describe("Streifen der letzten Scheiben (Plan N5, D2)", () => {
  const html = renderToStaticMarkup(
    h(FormStrip, { strip, average: { value: 8.9, n: 5 }, band: { low: 8.72, high: 9.08 } })
  )

  it("jede Scheibe ein Punkt, die des Abends größer in der Farbe des Akzents", () => {
    expect(html.match(/data-strip-dot=/g)).toHaveLength(7)
    expect([...html.matchAll(/<circle[^>]*data-tonight="true"[^>]*>/g)]).toHaveLength(2)
    for (const dot of html.match(/<circle[^>]*data-tonight="true"[^>]*>/g)!)
      expect(dot).toMatch(/class="[^"]*fill-primary/)
    // „Abend“, nicht „heute“: der letzte Abend muss nicht heute gewesen sein (Review N5)
    expect(html).toMatch(/<text[^>]*data-value="true"[^>]*>Abend<\/text>/)
    expect(html).not.toContain(">heute<")
  })

  it("Band und Schnitt nur, wo es sie gibt; der Name sagt beides in Worten", () => {
    expect(html).toContain("data-band")
    expect(html).toContain("data-average")
    expect(html).toContain(">Schnitt 8,90<")
    expect(html).toContain(
      'aria-label="Die letzten 7 Scheiben, die des Abends hervorgehoben; Formband 8,72 bis 9,08; Schnitt 8,90"'
    )
    const bare = renderToStaticMarkup(h(FormStrip, { strip, average: null, band: null }))
    expect(bare).not.toContain("data-band")
    expect(bare).not.toContain("data-average")
    expect(bare).toContain('aria-label="Die letzten 7 Scheiben, die des Abends hervorgehoben"')
  })

  it("ein einziger Wert: ein Punkt in der Mitte, eine Beschriftung, Einzahl im Namen", () => {
    const one = renderToStaticMarkup(
      h(FormStrip, { strip: [{ id: "x", value: 10.22, tonight: true }], average: null, band: null })
    )
    expect(one.match(/>10,22</g)).toHaveLength(1)
    expect(Number(/<circle[^>]*cx="([0-9.]+)"/.exec(one)?.[1])).toBeCloseTo(300, 6)
    expect(one).toContain('aria-label="Die letzte Scheibe, die des Abends hervorgehoben"')
  })

  it("Beschriftungen überlappen nicht: zu nah am Schnitt fällt der Rand weg, der Schnitt bleibt im Bild", () => {
    // der Schnitt fast am größten Wert: „Schnitt 9,24“ (12 Zeichen, ~94 px) läge über „9,25“
    const crowded = renderToStaticMarkup(
      h(FormStrip, { strip, average: { value: 9.24, n: 5 }, band: null })
    )
    expect(crowded).toContain(">Schnitt 9,24<")
    expect(crowded).not.toContain(">9,25<")
    expect(crowded).toContain(">8,70<")
    const x = Number(/<text x="([0-9.]+)"[^>]*>Schnitt 9,24</.exec(crowded)?.[1])
    expect(x + (12 * 7.2) / 2).toBeLessThanOrEqual(600)
  })

  it("nur Tokens, keine Palette-Klassen; kleinster und größter Wert an den Enden", () => {
    expect(html).not.toMatch(/\b(text|bg|fill|stroke)-(red|green|blue|amber|slate|gray)-\d/)
    expect(html).toContain(">8,70<")
    expect(html).toContain(">9,25<")
  })
})
