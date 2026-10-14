import { describe, expect, it } from "vitest"

import { inScoring, metricByKey, type Scoring } from "@vereinsheim/shot-core/metrics"

import type { OverviewCard, PendingFirstCard } from "@/lib/db/reads"

import { openItems, pendingItems } from "./open"

const ZONE = "Europe/Berlin"
const key = (scoring: Scoring) => inScoring(metricByKey("result.decimal")!, scoring).key

/** eine wartende Scheibe mit dem, was „Offen“ liest */
function pending(scoring: Scoring, value: number | null, more = 0): PendingFirstCard {
  const card = {
    id: "c1",
    startedAtMs: Date.UTC(2026, 9, 13, 17, 12),
    stand: "6",
    family: { slug: "lp-freihand", name: "Luftpistole" },
    targetId: "lp-10m",
    scoring,
    projection: {
      printedShots: 40,
      values: value === null ? {} : { [key(scoring)]: { value } },
    },
  } as unknown as OverviewCard
  return { sportpassId: "4711", card, more }
}

describe("Offen in Worten", () => {
  it("Abend und Uhrzeit in der Zone, Stand, Familie, Schusszahl, Ergebnis in der Wertung der Scheibe", () => {
    const [item] = pendingItems([pending("rings", 376, 2)], ZONE)
    expect(item).toMatchObject({
      cardId: "c1",
      sportpassId: "4711",
      more: 2,
      when: "Di 13.10.2026 · 19:12",
      stand: "6",
      family: "Luftpistole",
      shots: 40,
      result: "376 Ringe",
      targetId: "lp-10m",
    })
  })

  it("Zehntel mit Komma, ohne Wert keins", () => {
    expect(pendingItems([pending("decimal", 382.4)], ZONE)[0].result).toBe("382,4")
    expect(pendingItems([pending("decimal", null)], ZONE)[0].result).toBeNull()
  })

  it("auf Start je SportpassID ein Eintrag nach „Offen“", () => {
    const items = openItems(pendingItems([pending("rings", 376)], ZONE))
    expect(items).toEqual([
      {
        id: "c1",
        title: "Erste Scheibe bestätigen",
        detail: "Di 13.10.2026 · 19:12 · Luftpistole",
        route: { page: "open" },
      },
    ])
  })
})
