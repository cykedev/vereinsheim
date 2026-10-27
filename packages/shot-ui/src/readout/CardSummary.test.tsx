import type { CardSums } from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CENTER_ONLY_NOTE } from "../detail"
import { CardSummary, SummaryResult } from "./CardSummary"

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

const both = (
  sums: CardSums | undefined,
  d: CardDetail,
  level: "series" | "total" | "none",
  scoring: "decimal" | "rings" = "decimal",
  provenance: "entered" | "printout" = "entered"
) => {
  const card = { sums, provenance }
  const result = h(SummaryResult, { card, detail: d, level, scoring, onHelp: () => {} })
  return {
    result: renderToStaticMarkup(result),
    box: renderToStaticMarkup(
      h(CardSummary, { target: LP_10M, result, level, card, detail: d, scoring })
    ),
  }
}

describe("Seite einer Scheibe ohne Einzelschüsse", () => {
  it("Serien-Summen: die große Zahl aus den Serien, Ø je Schuss, Grund, Kacheln und was fehlt", () => {
    const { result, box } = both(SERIES, detail({ rings: "series", tenths: "series" }), "series")
    expect(text(result)).toContain("367,2 Ringe")
    expect(text(result)).toContain("40 Schuss · Ø 9,18 je Schuss")
    expect(result).toMatch(/data-summary-reason="true"[^>]*>nur Serien-Summen</)
    expect(result).toContain('data-help="grundlage"')
    expect(box).toMatch(/^<div data-card-summary="series"/)
    expect(box).toContain("data-sum-series")
    expect(text(box)).toContain("Für Streuung, Lage und Tempo braucht es Einzelschüsse.")
    expect(box).not.toContain("data-center-note")
  })

  it("Serien nur in Ringen, gezeigt in Zehnteln: „–“ und der Grund nennt beides", () => {
    const { result } = both(SERIES_RINGS, detail({ rings: "series", tenths: null }), "series")
    expect(result).toMatch(/<p data-result[^>]*>–<\/p>/)
    expect(text(result)).toContain("nur Serien-Summen · ohne Zehntel")
  })

  it("Gesamtergebnis mit Trefferlage: Grund, ein Satz ohne Lage und der Hinweis zum Zeichen der Mitte", () => {
    const d = detail({
      rings: "total",
      tenths: null,
      center: { xUm: 1400, yUm: -900, n: 40, from: "summary" },
    })
    const { result, box } = both(TOTAL, d, "total", "rings")
    expect(text(result)).toContain("362 Ringe")
    expect(result).toMatch(/data-summary-reason="true"[^>]*>nur Gesamtergebnis · ohne Zehntel</)
    expect(text(box)).toContain("Für Streuung und Tempo braucht es Einzelschüsse.")
    expect(text(box)).toContain(CENTER_ONLY_NOTE)
    // das Zeichen davor ist Schmuck: ohne Titel, die Zeile liest nur den Satz
    const note = /<p data-center-note[^>]*>([\s\S]*?)<\/p>/.exec(box)?.[1] ?? ""
    expect(note).not.toContain("<title>")
    expect(text(note)).toBe(CENTER_ONLY_NOTE)
    expect(box).not.toContain("data-sum-series")
  })

  it("vom Ausdruck ohne Werte: „–“, wartet auf die Anlage, ein Satz, wann Werte kommen", () => {
    const { result, box } = both(undefined, detail({}), "none", "decimal", "printout")
    expect(result).toMatch(/<p data-result[^>]*>–<\/p>/)
    expect(text(result)).toContain("wartet auf die Anlage")
    expect(text(result)).not.toContain("Schuss")
    expect(text(box)).toContain("Sobald die Anlage die Scheibe liefert")
    expect(box).toMatch(/^<div data-card-summary="none"/)
  })

  it("Platz für den Ausdruck am Ende der Box", () => {
    const card = { sums: undefined, provenance: "printout" as const }
    const box = renderToStaticMarkup(
      h(CardSummary, {
        target: LP_10M,
        result: null,
        level: "none",
        card,
        detail: detail({}),
        scoring: "decimal",
        printout: h("p", { "data-printout": true }, "AUSDRUCK"),
      })
    )
    expect(box).toMatch(/AUSDRUCK<\/p><\/div>$/)
  })
})
