import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { periodModel } from "./model"
import { PeriodInsights, recordRows } from "./PeriodInsights"
import { PeriodTiles } from "./PeriodTiles"
import { initialPeriodState, type PeriodState } from "./state"
import { NOW, periodCard, projected, TZ } from "./testSeason"

const model = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
  periodModel({
    cards: cards.map(projected),
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

  it("Rekorde in der Reihenfolge des Katalogs, außerhalb des Zeitraums nicht wählbar", () => {
    const old = periodCard("alt", 200, [109, 109, 109])
    const m = model([...now, old])
    const rows = recordRows(m.records, "decimal")
    // ganze Worte, gezeigt als „Bezeichnung: Wert“
    expect(rows[0]).toMatchObject({
      key: "R1:3",
      label: "Bestes Ergebnis (3 Schuss)",
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
