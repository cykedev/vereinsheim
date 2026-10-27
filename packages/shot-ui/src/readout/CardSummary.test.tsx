import type { CardSums } from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CENTER_ONLY_NOTE } from "../detail"
import { SummaryResult } from "./CardSummary"

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const SERIES: CardSums = {
  series: [921, 905, 934, 912].map((decimalTenths, i) => ({
    series: i + 1,
    shots: 10,
    rings: Math.floor(decimalTenths / 10) - 4,
    decimalTenths,
  })),
  total: null,
  center: null,
}
const SERIES_RINGS: CardSums = {
  series: SERIES.series.map((s) => ({ ...s, decimalTenths: null })),
  total: null,
  center: null,
}
const TOTAL: CardSums = {
  series: [],
  total: { shots: 40, rings: 362, decimalTenths: null },
  center: { xUm: 1400, yUm: -900, shots: 40 },
}
const detail = (part: Partial<CardDetail>): CardDetail => ({
  rings: null,
  tenths: null,
  positions: 0,
  times: 0,
  center: null,
  ...part,
})

const render = (
  sums: CardSums | undefined,
  d: CardDetail,
  level: "series" | "total" | "none",
  scoring: "decimal" | "rings" = "decimal",
  provenance: "entered" | "printout" | "measured" = "entered"
) =>
  renderToStaticMarkup(
    h(SummaryResult, { card: { sums, provenance }, detail: d, level, scoring, onHelp: () => {} })
  )

describe("Ergebnis einer Scheibe ohne Einzelschüsse, gebaut wie CardResult", () => {
  it("Serien-Summen: die große Zahl aus den Serien, Ø je Schuss, Grund, Kennzahlen „–“ mit Grund", () => {
    const result = render(SERIES, detail({ rings: "series", tenths: "series" }), "series")
    expect(result).toMatch(/^<div data-card-summary="series"/)
    expect(text(result)).toContain("367,2 Ringe")
    expect(text(result)).toContain("40 Schuss · Ø 9,18 je Schuss")
    expect(result).toMatch(/data-summary-reason="true"[^>]*>nur Serien-Summen</)
    expect(result).toContain('data-help="grundlage"')
    // dieselben Kennzahlen wie mit Schüssen, hier ohne Wert mit Grund
    expect(result).toContain('aria-label="Kennzahlen der Scheibe"')
    expect(result.match(/<span title="nur Summen">–/g)).toHaveLength(3)
    expect(result).not.toContain("data-center-note")
  })

  it("Serien nur in Ringen, gezeigt in Zehnteln: „–“ und der Grund nennt beides", () => {
    const result = render(SERIES_RINGS, detail({ rings: "series", tenths: null }), "series")
    expect(result).toMatch(/<p data-result[^>]*>–<\/p>/)
    expect(text(result)).toContain("nur Serien-Summen · ohne Zehntel")
  })

  it("Gesamtergebnis mit Trefferlage: Grund und der Hinweis zum Zeichen der Mitte", () => {
    const d = detail({
      rings: "total",
      tenths: null,
      center: { xUm: 1400, yUm: -900, n: 40, from: "summary" },
    })
    const result = render(TOTAL, d, "total", "rings")
    expect(text(result)).toContain("362 Ringe")
    expect(result).toMatch(/data-summary-reason="true"[^>]*>nur Gesamtergebnis · ohne Zehntel</)
    // das Zeichen davor ist Schmuck: ohne Titel, die Zeile liest nur den Satz
    const note = /<p data-center-note[^>]*>([\s\S]*?)<\/p>/.exec(result)?.[1] ?? ""
    expect(note).not.toContain("<title>")
    expect(text(note)).toBe(CENTER_ONLY_NOTE)
  })

  it("ohne Werte: „–“ mit dem Grund nach der Herkunft, ohne Schusszahl und Kennzahlen", () => {
    for (const [provenance, reason] of [
      ["printout", "wartet auf die Anlage"],
      ["entered", "ohne Werte"],
      ["measured", "noch kein Schuss"],
    ] as const) {
      const result = render(undefined, detail({}), "none", "decimal", provenance)
      expect(result).toMatch(/<p data-result[^>]*>–<\/p>/)
      expect(result).toMatch(new RegExp(`data-summary-reason="true"[^>]*>${reason}<`))
      expect(text(result)).not.toContain("Schuss ·")
      expect(result).not.toContain("Kennzahlen der Scheibe")
    }
  })

  it("vom Ausdruck ohne offenen Auftrag: „ohne Werte“ statt „wartet auf die Anlage“", () => {
    const result = renderToStaticMarkup(
      h(SummaryResult, {
        card: { sums: undefined, provenance: "printout", waiting: false },
        detail: detail({}),
        level: "none",
        scoring: "decimal",
      })
    )
    expect(result).toMatch(/data-summary-reason="true"[^>]*>ohne Werte</)
  })
})
