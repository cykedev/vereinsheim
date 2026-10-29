import { describe, expect, it } from "vitest"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { MetricShot, Scoring } from "@vereinsheim/shot-core/metrics"
import { cardProjection } from "@vereinsheim/shot-core/projection"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"

import { cardTotals } from "./results-read"

const ZONE = "Europe/Berlin"
const START = Date.UTC(2026, 2, 13, 18)

// Zehntel so gewählt, dass ganze Ringe und Zehntel nicht ineinander umzurechnen sind (98 Zehntel sind 9 Ringe)
const shot = (series: number, decimalTenths: number): MetricShot => ({
  xUm: null,
  yUm: null,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen: null,
  firedAtMs: null,
  kind: "match",
  series,
})

const card = (id: string, over: Partial<PeriodCard>): PeriodCard => ({
  id,
  startedAtMs: START,
  kind: "training",
  complete: true,
  shots: [],
  ...over,
})

const LEVELS: Record<string, PeriodCard> = {
  shots: card("shots", {
    shots: [shot(1, 98), shot(1, 104), shot(2, 87), shot(2, 109)],
  }),
  series: card("series", {
    sums: {
      series: [
        { series: 1, shots: 10, rings: 93, decimalTenths: 978 },
        { series: 2, shots: 10, rings: 95, decimalTenths: 996 },
      ],
      total: null,
      center: null,
    },
  }),
  total: card("total", {
    sums: { series: [], total: { shots: 40, rings: 371, decimalTenths: 3893 }, center: null },
  }),
  none: card("none", { sums: { series: [], total: null, center: null } }),
}

/** das Ergebnis in der Spalte der Liste, wenn die Scheibe in dieser Wertung zählt */
function listResult(periodCard: PeriodCard, scoring: Scoring): number | null {
  const projected = {
    id: periodCard.id,
    startedAtMs: periodCard.startedAtMs,
    kind: periodCard.kind,
    complete: periodCard.complete,
    flags: [],
    scoring,
    projection: cardProjection(periodCard),
  }
  const model = cardListModel(
    [{ card: projected, family: "lp", provenance: "entered" }],
    { ...DEFAULT_LIST, family: "lp" },
    { timeZone: ZONE, nowMs: START + 86_400_000, named: [], scoring }
  )
  const row = model.evenings[0].rows[0]
  expect(row.resultScoring).toBe(scoring)
  return row.result
}

describe("cardTotals", () => {
  it.each(Object.keys(LEVELS))(
    "ist in der Detailtiefe %s dasselbe Ergebnis wie in der Liste, in Ringen und in Zehnteln",
    (level) => {
      const periodCard = LEVELS[level]
      const totals = cardTotals(cardProjection(periodCard))
      const rings = listResult(periodCard, "rings")
      const decimal = listResult(periodCard, "decimal")
      expect(totals.rings).toBe(rings)
      expect(totals.decimalTenths).toBe(decimal === null ? null : Math.round(decimal * 10))
    }
  )

  it("liefert die erwarteten Zahlen je Detailtiefe", () => {
    const of = (level: string) => cardTotals(cardProjection(LEVELS[level]))
    expect(of("shots")).toEqual({ rings: 9 + 10 + 8 + 10, decimalTenths: 98 + 104 + 87 + 109 })
    expect(of("series")).toEqual({ rings: 188, decimalTenths: 1974 })
    expect(of("total")).toEqual({ rings: 371, decimalTenths: 3893 })
    expect(of("none")).toEqual({ rings: null, decimalTenths: null })
  })
})
