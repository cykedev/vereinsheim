import { metricByKey } from "@vereinsheim/shot-core/metrics"
import { LG_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardList } from "./CardList"
import { CardLine, CardReadout } from "./CardReadout"
import { lightPeriodModel, periodModel, periodReading, type PeriodModel } from "./model"
import { PeriodChart } from "./PeriodChart"
import { PeriodInsights } from "./PeriodInsights"
import { PeriodResult } from "./PeriodResult"
import { PeriodTiles } from "./PeriodTiles"
import { initialPeriodState } from "./state"
import { marksOf, NOW, periodCard, projected, TZ } from "./testSeason"

// zwölf Scheiben: Training, ein Wettkampf, eine nur Probe; dazu eine ältere als Vergleich
const RAW = [9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10].map((v, i) =>
  periodCard(`k${i}`, 60 - 3 * i, [v * 10, v * 10 + 3, v * 10 - 2], {
    kind: i === 3 ? "competition" : "training",
    probe: i === 5,
  })
)
const full = periodModel({
  cards: RAW.map(projected),
  state: { ...initialPeriodState({ family: "lg-10m" }), compare: { type: "previous" } },
  nowMs: NOW,
  timeZone: TZ,
  named: [],
})
const light = lightPeriodModel(full)
const route = (id: string) => ({
  page: "card" as const,
  id,
  origin: null,
  selection: null,
  shot: null,
  scoring: "decimal" as const,
  anchor: null,
})

/** alles, was die Bausteine der Seite aus dem Modell zeichnen */
function page(model: PeriodModel, chosen: string | null) {
  const reading = periodReading(model, chosen)!
  const value = model.values.find((v) => v.id === reading.card.id) ?? null
  const delta = model.deltas.get(reading.card.id)
  return [
    renderToStaticMarkup(
      h(PeriodChart, { width: 600, model, timeZone: TZ, chosen, onChoose: () => {} })
    ),
    renderToStaticMarkup(h(PeriodResult, { model, timeZone: TZ })),
    renderToStaticMarkup(h(PeriodTiles, { tiles: model.tiles, compareLabel: "davor" })),
    renderToStaticMarkup(
      h(PeriodInsights, { model, scoring: "decimal", timeZone: TZ, explain: true })
    ),
    renderToStaticMarkup(
      h(CardList, {
        cards: model.cards,
        values: model.values,
        deltas: model.deltas,
        metric: model.metric,
        timeZone: TZ,
        chosen,
      })
    ),
    renderToStaticMarkup(
      h(CardReadout, {
        card: reading.card,
        marks: marksOf(RAW).get(reading.card.id)!,
        target: LG_10M,
        value,
        point: reading.point,
        delta,
        metric: model.metric,
        timeZone: TZ,
        chosen: reading.chosen,
        cardRoute: route,
      })
    ),
    renderToStaticMarkup(
      h(CardLine, {
        card: reading.card,
        value,
        delta,
        metric: model.metric,
        timeZone: TZ,
        cardRoute: route,
      })
    ),
  ]
}

describe("lightPeriodModel: das Modell für den Browser", () => {
  it("die Scheiben ohne Werte und Rekorde ihrer Projektion, alles andere bleibt", () => {
    expect(light.cards.map((c) => c.id)).toEqual(full.cards.map((c) => c.id))
    for (const card of light.cards) {
      expect(card.projection.values).toEqual({})
      expect(card.projection.records).toEqual({ decimal: null, rings: null })
    }
    const original = full.cards.find((c) => c.id === "k5")!
    expect(light.cards.find((c) => c.id === "k5")!.projection).toMatchObject({
      probeOnly: true,
      printedShots: original.projection.printedShots,
      suspicious: original.projection.suspicious,
      version: original.projection.version,
    })
    expect(light.reading?.card).toBe(light.cards.find((c) => c.id === full.reading?.card.id))
    const { cards: _a, reading: _b, ...rest } = light
    const { cards: _c, reading: _d, ...restFull } = full
    expect(rest).toEqual(restFull)
  })

  it("die Bausteine zeichnen damit dasselbe, ohne und mit Wahl (auch Wettkampf und nur Probe)", () => {
    for (const chosen of [null, "k3", "k5", "k11"])
      expect(page(light, chosen)).toEqual(page(full, chosen))
  })

  it("ohne Funktionen: das Modell geht vom Server zum Browser", () => {
    const functions: string[] = []
    const walk = (value: unknown, path: string) => {
      if (typeof value === "function") functions.push(path)
      else if (value instanceof Map) value.forEach((v, k) => walk(v, `${path}.${String(k)}`))
      else if (value && typeof value === "object")
        for (const [key, v] of Object.entries(value)) walk(v, `${path}.${key}`)
    }
    walk(light, "model")
    expect(functions).toEqual([])
    expect(light.metric).toMatchObject({ key: "result.decimalMean", label: "Ø je Schuss" })
  })

  it("das leichte Modell ist kleiner", () => {
    expect(JSON.stringify(light.cards).length).toBeLessThan(JSON.stringify(full.cards).length / 3)
  })
})
