import { createElement as h, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HelpTextsProvider } from "../help/HelpTexts"
import {
  progressQueryFromParams,
  PROGRESS_METRICS,
  routeFromUrl,
  urlFromRoute,
} from "../nav/routes"
import { CardList } from "./CardList"
import { CardLine, CardReadout } from "./CardReadout"
import { PERIOD_TILE_KEYS, periodModel, periodReading } from "./model"
import { PeriodChart } from "./PeriodChart"
import { PeriodChartBar } from "./PeriodChartBar"
import { PeriodInsights } from "./PeriodInsights"
import { PeriodResult } from "./PeriodResult"
import { PeriodTiles } from "./PeriodTiles"
import { PeriodWordsProvider } from "./PeriodWords"
import { recordRows } from "./records"
import { periodSentence, verdictText } from "./sentence"
import { initialPeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"
import { VolumeChart, weekText } from "./VolumeChart"
import { periodCountText, type PeriodWords } from "./words"

const UNIT: PeriodWords = {
  one: "Einheit",
  many: "Einheiten",
  noRecords: "Noch kein Rekord. Es zählen nur Einheiten mit Einzelschüssen in jeder Serie.",
}

const CARDS = [9, 10, 8, 10, 9, 11, 9].map((v, i) =>
  periodCard(`k${i}`, 40 - 3 * i, [v * 10, v * 10 + 3, v * 10 - 2], {
    kind: i === 3 ? "competition" : "training",
  })
)
const model = periodModel({
  items: CARDS.map(item),
  state: { ...initialPeriodState({ family: "lg-10m" }), compare: { type: "previous" } },
  nowMs: NOW,
  timeZone: TZ,
  named: [],
})
const reading = periodReading(model, null)!
const link = (_id: string, props: { className?: string; children?: ReactNode }) =>
  h("a", { href: "#", className: props.className }, props.children)

/** alles, was die Seite eines Zeitraums an Wörtern zeigt, mit und ohne eigene Wörter */
function page(words: PeriodWords | null) {
  const value = model.values.find((v) => v.id === reading.card.id) ?? null
  const parts = [
    h(PeriodChart, { width: 600, model, timeZone: TZ, chosen: null, onChoose: () => {} }),
    h(PeriodChartBar, {
      metric: "result.decimalMean",
      view: "cards",
      onMetric: () => {},
      onView: () => {},
      onHelp: () => {},
    }),
    h(VolumeChart, {
      width: 600,
      weeks: [{ key: "2026-W30", label: "20.07.", shots: 40, cards: 1, days: 1 }],
    }),
    h(PeriodResult, { model, timeZone: TZ }),
    h(PeriodTiles, { tiles: model.tiles, compareLabel: "davor" }),
    h(PeriodInsights, {
      model: { ...model, records: { ...model.records, bestCard: {}, bestForm: null } },
      scoring: "decimal",
      timeZone: TZ,
      explain: true,
    }),
    h(CardList, {
      cards: model.cards,
      values: model.values,
      deltas: model.deltas,
      metric: model.metric,
      timeZone: TZ,
      chosen: null,
    }),
    h(CardReadout, {
      card: reading.card,
      marks: [],
      target: null,
      value,
      point: reading.point,
      delta: model.deltas.get(reading.card.id),
      metric: model.metric,
      timeZone: TZ,
      chosen: false,
      renderLink: link,
    }),
    h(CardLine, {
      card: reading.card,
      value,
      delta: model.deltas.get(reading.card.id),
      metric: model.metric,
      timeZone: TZ,
      renderLink: link,
    }),
  ]
  const tree = h("div", null, ...parts)
  return renderToStaticMarkup(
    words
      ? h(
          HelpTextsProvider,
          { lookup: (id: string) => ({ title: id, short: "Bestwerte über alle Einheiten" }) },
          h(PeriodWordsProvider, { words }, tree)
        )
      : tree
  )
}

describe("Wörter der Seite eines Zeitraums", () => {
  it("sagen ohne eigene Wörter „Scheibe“ wie in Spiegel", () => {
    const html = page(null)
    expect(html).toContain("Neueste Scheibe")
    expect(html).toContain("Scheibe öffnen")
    expect(html).toContain("Mittel je Scheibe")
    expect(html).toMatch(/>je Scheibe</)
    expect(html).not.toContain("Einheit")
  })

  it("sagen mit den Wörtern von Treffsicher überall „Einheit“", () => {
    const html = page(UNIT)
    expect(html).toContain("Neueste Einheit")
    expect(html).toContain("Einheit öffnen")
    expect(html).toContain("Mittel je Einheit")
    expect(html).toContain("je Einheit")
    expect(html).toContain("Analyse über die Einheiten")
    expect(html).toContain("7 Einheiten")
    expect(html).toContain("Bestwerte über alle Einheiten")
    expect(html).not.toMatch(/Scheibe/)
  })

  it("nehmen sie auch in den reinen Texten", () => {
    const comparison = { ...model.comparison!, test: null }
    expect(verdictText(comparison, "higher", UNIT)).toBe("zu wenige Einheiten")
    expect(verdictText(comparison, "higher")).toBe("zu wenige Scheiben")
    expect(
      periodSentence({ form: { comparison, label: "Zeitraum davor", lastDays: null } }, UNIT)
    ).toBe("Für einen Vergleich mit dem Zeitraum davor sind es zu wenige Einheiten.")
    expect(weekText({ key: "2026-W30", label: "20.07.", shots: 40, cards: 3, days: 2 }, UNIT)).toBe(
      "Woche ab 20.07.2026: 40 Schuss, 3 Einheiten, 2 Tage"
    )
    const labels = recordRows(model.records, "decimal", UNIT).map((r) => r.label)
    expect(labels.some((l) => l.includes("Einheit zu"))).toBe(true)
    expect(labels.join(" ")).not.toMatch(/Scheibe/)
  })

  it("ohne Rekord sagt die Analyse, welche Einträge zählen", () => {
    expect(page(UNIT)).not.toContain(UNIT.noRecords)
    const empty = renderToStaticMarkup(
      h(
        PeriodWordsProvider,
        { words: UNIT },
        h(PeriodInsights, {
          model: {
            cards: [],
            records: periodModel({
              items: [],
              state: initialPeriodState({ family: "lg-10m" }),
              nowMs: NOW,
              timeZone: TZ,
              named: [],
            }).records,
          },
          scoring: "decimal",
          timeZone: TZ,
          explain: false,
        })
      )
    )
    expect(empty).toContain(UNIT.noRecords)
  })
})

describe("Ablesung ohne Scheibenbild", () => {
  it("zeigt keine kleine Scheibe und kein „ohne Lage“", () => {
    const html = page(UNIT)
    expect(html).not.toContain("ohne Lage")
    expect(html).not.toContain("data-marks-loading")
  })
})

describe("Kennzahlen als Parameter", () => {
  it("die Kacheln folgen `tileKeys`, ohne sie die von Spiegel", () => {
    const keys = ["result.decimalMean", "result.tensRate", "group.mpiDistance"]
    const own = periodModel({
      items: CARDS.map(item),
      tileKeys: keys,
      state: initialPeriodState({ family: "lg-10m" }),
      nowMs: NOW,
      timeZone: TZ,
      named: [],
    })
    expect(own.tiles.map((t) => t.key)).toEqual(keys)
    expect(model.tiles.map((t) => t.key)).toEqual([...PERIOD_TILE_KEYS])
  })

  it("die Leiste über dem Verlauf bietet die gegebenen Kennzahlen an", () => {
    const html = renderToStaticMarkup(
      h(PeriodChartBar, {
        metric: "group.mpiDistance",
        view: "cards",
        onMetric: () => {},
        onView: () => {},
        onHelp: () => {},
        metrics: [
          { key: "result.decimalMean", label: "Ø je Schuss" },
          { key: "group.mpiDistance", label: "Lage" },
        ],
      })
    )
    expect(html).toMatch(/>Lage</)
    expect(html).not.toMatch(/>Streuung</)
  })

  it("der Schwerpunkt-Abstand geht nur durch die Adresse einer Seite, die ihn anbietet", () => {
    const state = {
      ...initialPeriodState({ family: "lg-10m" }),
      metric: "group.mpiDistance" as const,
    }
    const url = urlFromRoute({ page: "progress", query: state, section: null })
    expect(url).toContain("metric=location")
    // Spiegel bietet ihn nicht an: die Vorgabe
    const back = routeFromUrl("/progress", url.split("?")[1] ?? "", "")
    expect(back.page === "progress" && back.query.metric).toBe("result.decimalMean")
    const params = new URLSearchParams(url.split("?")[1])
    expect(progressQueryFromParams(params, [...PROGRESS_METRICS, "group.mpiDistance"]).metric).toBe(
      "group.mpiDistance"
    )
  })
})

describe("Zahl im Kopf eines Zeitraums", () => {
  it("Einzahl und Mehrzahl, Einschießen nur, wenn es nicht zählt", () => {
    expect(periodCountText(1, 0)).toBe("1 Scheibe")
    expect(periodCountText(14, 0)).toBe("14 Scheiben")
    expect(periodCountText(14, 2)).toBe("14 Scheiben, 2 Einschießen nicht gezählt")
    expect(periodCountText(1, 1)).toBe("1 Scheibe, 1 Einschießen nicht gezählt")
    expect(periodCountText(3, 0, { one: "Einheit", many: "Einheiten", noRecords: "" })).toBe(
      "3 Einheiten"
    )
  })
})
