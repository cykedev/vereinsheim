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
import { item, marksOf, NOW, periodCard, TZ } from "./testSeason"

// zwölf Scheiben: Training, ein Wettkampf, eine nur Probe; dazu eine ältere als Vergleich
const RAW = [9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10].map((v, i) =>
  periodCard(`k${i}`, 60 - 3 * i, [v * 10, v * 10 + 3, v * 10 - 2], {
    kind: i === 3 ? "competition" : "training",
    probe: i === 5,
  })
)
const full = periodModel({
  items: RAW.map(item),
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
  it("die Scheiben ohne Werte und Rekorde, alles andere bleibt", () => {
    expect(light.cards.map((c) => c.id)).toEqual(full.cards.map((c) => c.id))
    for (const card of light.cards) {
      expect(card.metrics).toEqual({})
      expect(card.records).toEqual({ decimal: null, rings: null })
    }
    const original = full.cards.find((c) => c.id === "k5")!
    expect(light.cards.find((c) => c.id === "k5")).toMatchObject({
      probeOnly: true,
      shots: original.shots,
      flags: original.flags,
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

  it("auch ohne Vergleich, je Scheibe und je Monat", () => {
    for (const view of ["cards", "months"] as const) {
      const plain = periodModel({
        items: RAW.map(item),
        state: { ...initialPeriodState({ family: "lg-10m" }), view },
        nowMs: NOW,
        timeZone: TZ,
        named: [],
      })
      for (const chosen of [null, "k5"])
        expect(page(lightPeriodModel(plain), chosen), view).toEqual(page(plain, chosen))
    }
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

  it("nur die Felder eines Eintrags, auch wenn die App mehr hereinreicht", () => {
    const withExtras = periodModel({
      items: RAW.map((card) => ({
        ...item(card),
        stand: "3",
        family: { slug: "lg", name: "LG" },
      })),
      state: initialPeriodState({ family: "lg-10m" }),
      nowMs: NOW,
      timeZone: TZ,
      named: [],
    })
    const card = lightPeriodModel(withExtras).cards[0]
    expect(Object.keys(card).sort()).toEqual(
      ["flags", "id", "kind", "metrics", "probeOnly", "records", "shots", "startedAtMs"].sort()
    )
  })

  it("das leichte Modell ist kleiner", () => {
    expect(JSON.stringify(light.cards).length).toBeLessThan(JSON.stringify(full.cards).length / 3)
  })
})
