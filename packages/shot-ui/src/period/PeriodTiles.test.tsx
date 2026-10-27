import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { periodModel } from "./model"
import { PeriodInsights, recordRows } from "./PeriodInsights"
import { PeriodTiles } from "./PeriodTiles"
import { initialPeriodState, type PeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"

const model = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
  periodModel({
    items: cards.map(item),
    state: { ...initialPeriodState({ family: "lg-10m" }), ...partial },
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })
const now = [60, 70, 80, 90, 100].map((t, i) => periodCard(`n${i}`, 10 + i, [t, t, t]))
const before = [10, 20, 30, 40, 50].map((t, i) => periodCard(`v${i}`, 100 + i, [t, t, t]))

describe("Zahlen über den Zeitraum", () => {
  it("sechs Kacheln mit Mittel je Scheibe und Zahl der Scheiben", () => {
    const m = model(now)
    const html = renderToStaticMarkup(h(PeriodTiles, { tiles: m.tiles, compareLabel: null }))
    expect([...html.matchAll(/data-period-tile="/g)]).toHaveLength(6)
    expect(html).toMatch(
      /data-period-tile="result.decimalMean"[\s\S]*?8,00<small[^>]*>Ringe[\s\S]*?5 Scheiben/
    )
    expect(html).not.toContain("data-tile-compare")
    // auch kein Tooltip mit Fachbegriffen: Die Erklärung steht im Blatt „?“
    expect(html).not.toMatch(/title="|R50|σ/)
  })

  it("eine ungerade letzte Kachel füllt im Raster aus zwei Spalten die Zeile, ab drei Spalten nicht", () => {
    const tiles = periodModel({
      items: now.map(item),
      state: initialPeriodState({ family: "lg-10m" }),
      nowMs: NOW,
      timeZone: TZ,
      named: [],
      tileKeys: ["result.decimalMean", "result.tensRate", "group.sigma"],
    }).tiles
    const html = renderToStaticMarkup(h(PeriodTiles, { tiles, compareLabel: null }))
    expect([...html.matchAll(/data-period-tile="/g)]).toHaveLength(3)
    for (const cls of [...html.matchAll(/data-period-tile="[^"]*" class="([^"]*)"/g)].map(
      (m) => m[1]
    )) {
      expect(cls).toContain("last:odd:col-span-2")
      expect(cls).toContain("@min-[27rem]:last:odd:col-span-1")
    }
  })

  it("mit Vergleich: Wert dort, Δ und Urteil; ohne Wert ein Strich mit Grund", () => {
    const m = model([...now, ...before], { compare: { type: "previous" } })
    const html = renderToStaticMarkup(
      h(PeriodTiles, { tiles: m.tiles, compareLabel: "Zeitraum davor" })
    )
    expect(html).toMatch(
      /data-period-tile="result.decimalMean"[\s\S]*?Zeitraum davor: 3,00<br\/><span[^>]*>Δ \+5,00 · <\/span><span[^>]*>deutlich besser/
    )
    // drei Schüsse ohne Zeit zwischen ihnen gibt es nicht: das Tempo hat Werte; ohne Scheiben ein Strich
    const empty = renderToStaticMarkup(
      h(PeriodTiles, { tiles: model([]).tiles, compareLabel: null })
    )
    expect(empty).toContain("keine Scheibe mit Wert")
  })
})

describe("Analyse über den Zeitraum", () => {
  const render = (
    cards: ReturnType<typeof periodCard>[],
    partial: Partial<PeriodState> = {},
    chosen: string | null = null
  ) =>
    renderToStaticMarkup(
      h(PeriodInsights, {
        model: model(cards, partial),
        scoring: "decimal",
        timeZone: TZ,
        explain: false,
        onHelp: () => {},
        onChoose: () => {},
        chosen,
      })
    )
  /** die Zeilen der Rekorde (Liste oben und alle), je Zeile ihr Markup */
  const recordItems = (html: string) =>
    [...html.matchAll(/<li data-record="([^"]+)" data-record-card="([^"]+)"[\s\S]*?<\/li>/g)].map(
      (m) => ({ key: m[1], card: m[2], html: m[0] })
    )

  it("keine Karte „Gegen deinen Schnitt“: die Ablesung sagt den Abstand zu den fünf davor", () => {
    const html = render(now)
    expect(html).not.toContain('data-help="gegen-den-schnitt"')
    expect(html).not.toContain("Gegen deinen Schnitt")
    expect(html).not.toContain("Platz unter deinen letzten")
  })

  it("Rekorde: oben höchstens fünf aus dem Zeitraum, alle zugeklappt darunter", () => {
    // nur Scheiben im Zeitraum: jeder Rekord liegt darin, oben stehen trotzdem höchstens fünf
    const m = model(now)
    const all = recordRows(m.records, "decimal")
    const here = new Set(m.cards.map((c) => c.id))
    const html = render(now)
    const top = html.slice(html.indexOf("data-records-new"), html.indexOf("data-all-records"))
    const topKeys = [...top.matchAll(/data-record="([^"]+)"/g)].map((r) => r[1])
    const expected = all.filter((r) => here.has(r.record.cardId)).map((r) => r.key)
    expect(expected.length).toBeGreaterThan(5)
    expect(topKeys).toEqual(expected.slice(0, 5))
    expect(html).toMatch(
      /<details data-all-records="true"[^>]*><summary[^>]*>Alle Rekorde \((\d+)\)<\/summary>/
    )
    expect(Number(/Alle Rekorde \((\d+)\)/.exec(html)?.[1])).toBe(all.length)
    // ohne Rekord im Zeitraum der Satz, die Rekorde bleiben zugeklappt erreichbar
    const empty = render(now, { choice: { type: "free", from: "2026-01-01", to: "2026-01-31" } })
    expect(empty).toContain("Im Zeitraum kein neuer Rekord.")
    expect(empty).toContain("data-all-records")
  })

  it("mehr neue Rekorde im Zeitraum, als oben stehen: alle aufgeklappt, sonst zugeklappt", () => {
    const allOpen = (html: string) => /<details data-all-records="true" open=""/.test(html)
    const here = recordRows(model(now).records, "decimal")
    expect(here.length).toBeGreaterThan(5)
    expect(allOpen(render(now))).toBe(true)
    // nur eine Scheibe im Zeitraum, die übrigen davor: höchstens fünf neue
    const one = [periodCard("solo", 10, [30, 30, 30]), ...before]
    const rows = recordRows(model(one).records, "decimal")
    expect(rows.filter((r) => r.record.cardId === "solo").length).toBeLessThanOrEqual(5)
    expect(allOpen(render(one))).toBe(false)
  })

  it("Rekorde in der Reihenfolge des Katalogs, außerhalb des Zeitraums nicht wählbar", () => {
    const old = periodCard("alt", 200, [109, 109, 109])
    const m = model([...now, old])
    const rows = recordRows(m.records, "decimal")
    // ganze Worte, gezeigt als „Bezeichnung: Wert“
    expect(rows[0]).toMatchObject({
      key: "R1:3",
      label: "Bestes Ergebnis, Scheibe zu 3 Schuss",
      value: "32,7 Ringe",
    })
    expect(rows.find((r) => r.key === "R3")?.label).toBe("Bester Teiler")
    expect(rows.find((r) => r.key === "R8")?.label).toBe("Beste Form (Ø über 5 Scheiben)")
    expect(rows.map((r) => r.key)).toContain("R3")
    const html = render([...now, old])
    const items = recordItems(html)
    // außerhalb: kein Knopf, nur der Hinweis
    const outside = items.find((r) => r.key === "R1:3")
    expect(outside?.card).toBe("alt")
    expect(outside?.html).not.toContain("<button")
    expect(outside?.html).toContain('title="außerhalb des Zeitraums"')
    expect(outside?.html).toContain('außerhalb<span class="sr-only"> des Zeitraums</span>')
    // im Zeitraum: die ganze Zeile ist der Knopf, sein Name ist sein Inhalt (Bezeichnung, Wert, Datum, „zeigen“)
    const form = items.find((r) => r.key === "R8")?.html ?? ""
    expect(form).toMatch(
      /^<li[^>]*><button type="button"[^>]*>[\s\S]*Beste Form \(Ø über 5 Scheiben\): [\s\S]*zeigen[\s\S]*<\/button><\/li>$/
    )
    expect(form).not.toContain("aria-label")
    expect(html).toMatch(/data-record="R3"[\s\S]*?>Bester Teiler: <\/span>/)
  })

  it("Rekorde der gewählten Scheibe markiert, „gezeigt“ statt „zeigen“; ohne Wahl keiner", () => {
    const records = recordItems(render(now))
    expect(records.length).toBeGreaterThan(0)
    expect(records.some((r) => r.html.includes("aria-current"))).toBe(false)
    expect(records.some((r) => r.html.includes("gezeigt"))).toBe(false)

    // die Scheibe mit den meisten Rekorden wählen, die anderen bleiben unmarkiert
    const count = new Map<string, number>()
    for (const r of records) count.set(r.card, (count.get(r.card) ?? 0) + 1)
    const [chosen] = [...count].sort((a, b) => b[1] - a[1])[0]
    const marked = recordItems(render(now, {}, chosen))
    expect(marked.some((r) => r.card !== chosen)).toBe(true)
    for (const r of marked) {
      const mine = r.card === chosen
      expect(r.html.includes('aria-current="true"'), r.key).toBe(mine)
      expect(r.html.includes("aria-pressed"), r.key).toBe(false)
      expect(r.html.includes("bg-accent-wash"), r.key).toBe(mine)
      expect(/>gezeigt</.test(r.html), r.key).toBe(mine)
      expect(/>zeigen</.test(r.html), r.key).toBe(!mine)
    }
  })

  it("ohne Scheiben: der Hinweis statt einer leeren Karte", () => {
    const html = render([])
    expect(html).toContain("Noch kein Rekord")
    expect(html).not.toContain("data-all-records")
  })
})

describe("Bezeichnungen der Rekorde", () => {
  const at = (value: number, detail?: string) => ({
    value,
    cardId: "a",
    atMs: NOW,
    ...(detail ? { detail } : {}),
  })
  const records = {
    bestCard: { 40: at(353) },
    bestSeries: { 10: at(94, "Serie 1") },
    bestTeiler: at(87.2, "Schuss 30"),
    tightestSeries: at(28.2, "Serie 4"),
    tightestCard: { 10: at(36.6) },
    mostPerfect: { 40: at(1) },
    mostTens: { 10: at(1), 40: at(13) },
    mostTensSeries: { 10: at(6, "Serie 4") },
    mostInnerTens: { 40: at(10) },
    mostInnerTensSeries: { 10: at(3, "Serie 4") },
    longestTenRun: at(4, "ab Schuss 32"),
    longestNineRun: at(11, "ab Schuss 30"),
    bestForm: at(8.69),
    bestWeakestShot: { 40: at(7, "Schuss 12") },
    smallestSeriesSpan: { 40: at(4) },
  }

  it("sagen, ob eine Scheibe oder eine Serie gemeint ist, in der Reihenfolge des Katalogs", () => {
    const rows = recordRows(records, "rings")
    expect(rows.map((r) => `${r.key} ${r.label}: ${r.value}`)).toEqual([
      "R1:40 Bestes Ergebnis, Scheibe zu 40 Schuss: 353 Ringe",
      "R2:10 Beste Serie zu 10 Schuss: 94 Ringe",
      "R3 Bester Teiler: 87,2",
      "R4s Engste Serie zu 10 Schuss: 28,2 mm Streukreis",
      "R4:10 Engste Scheibe zu 10 Schuss: 36,6 mm Streukreis",
      "R5:40 Meiste 10,9 auf einer Scheibe zu 40 Schuss: 1",
      "R6z:10 Meiste Zehner auf einer Scheibe zu 10 Schuss: 1",
      "R6z:40 Meiste Zehner auf einer Scheibe zu 40 Schuss: 13",
      "R6zs:10 Meiste Zehner in einer Serie zu 10 Schuss: 6",
      "R6i:40 Meiste Innenzehner auf einer Scheibe zu 40 Schuss: 10",
      "R6is:10 Meiste Innenzehner in einer Serie zu 10 Schuss: 3",
      "R7 Längste Zehnerfolge: 4 Schuss",
      "R7n Längste Folge ohne Schuss unter 9: 11 Schuss",
      "R8 Beste Form (Ø über 5 Scheiben): 8,69",
      "R10:40 Bester schwächster Schuss, Scheibe zu 40 Schuss: 7 Ringe",
      "R11:40 Kleinste Spanne der Serien, Scheibe zu 40 Schuss: 4 Ringe",
    ])
    expect(rows.some((r) => /\(\d+ Schuss\)/.test(r.label))).toBe(false)
  })

  it("in Zehnteln mit einer Stelle", () => {
    const rows = recordRows(
      { ...records, bestWeakestShot: { 40: at(7.1) }, smallestSeriesSpan: { 40: at(3.9) } },
      "decimal"
    )
    expect(rows.find((r) => r.key === "R10:40")?.value).toBe("7,1 Ringe")
    expect(rows.find((r) => r.key === "R11:40")?.value).toBe("3,9 Ringe")
  })

  it("ein Ring in der Einzahl", () => {
    const rows = recordRows({ ...records, smallestSeriesSpan: { 20: at(1) } }, "rings")
    expect(rows.find((r) => r.key === "R11:20")?.value).toBe("1 Ring")
  })
})

describe("Grundlage und Herkunft über den Zeitraum", () => {
  const SERIES = {
    series: [1, 2, 3, 4].map((series) => ({ series, shots: 10, rings: 104, decimalTenths: 1080 })),
    total: null,
    center: null,
  }
  const entered = {
    ...item({ ...periodCard("s", 5, []), sums: SERIES }),
    provenance: "entered" as const,
  }
  const m = periodModel({
    items: [...now.map(item), entered],
    state: initialPeriodState({ family: "lg-10m" }),
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })

  it("eine Kachel, die nicht über alle rechnet, nennt ihre Grundlage statt der Zahl", () => {
    const html = renderToStaticMarkup(h(PeriodTiles, { tiles: m.tiles, compareLabel: null }))
    const sigma = html.slice(html.indexOf('data-period-tile="group.sigma"'))
    expect(sigma).toMatch(
      /^[^]*?<span data-basis="true">über 5 von 6 Scheiben · 1 ohne Lage je Schuss<\/span>/
    )
    const mean = html.slice(
      html.indexOf('data-period-tile="result.decimalMean"'),
      html.indexOf('data-period-tile="result.tensRate"')
    )
    expect(mean).not.toContain("data-basis")
    expect(mean).toContain("6 Scheiben")
  })

  it("ein Rekord aus einer eingetragenen Scheibe nennt die Herkunft leise", () => {
    const html = renderToStaticMarkup(
      h(PeriodInsights, { model: m, scoring: "decimal", timeZone: TZ, explain: false })
    )
    const row = html.slice(html.indexOf('data-record-card="s"'))
    expect(row.slice(0, row.indexOf("</li>"))).toContain(" · eingetragen")
    expect(html).not.toContain("gemessen")
  })
})
