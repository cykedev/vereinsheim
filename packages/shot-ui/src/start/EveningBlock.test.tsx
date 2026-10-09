import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { ListInputCard } from "../list/evenings"
import { openCard } from "../nav/navigate"
import { DEFAULT_LIST } from "../nav/routes"
import { NOW, periodCard, TZ } from "../period/testSeason"
import { EveningBlock } from "./EveningBlock"
import { startModel } from "./model"

const at = (day: number, hour: number) => Date.UTC(2026, 8, day, hour - 2)
const lp = (card: PeriodCard): ListInputCard => ({ card, family: "lp-freihand" })
const render = (cards: ListInputCard[]) => {
  const model = startModel({
    cards,
    timeZone: TZ,
    nowMs: NOW,
    named: [],
    scoring: "decimal",
    family: null,
  })
  const block = model.blocks[0]
  return renderToStaticMarkup(
    h(EveningBlock, {
      block,
      familyLabel: "Luftpistole",
      cards: new Map(cards.map((c) => [c.card.id, c.card])),
      target: LP_10M,
      timeZone: TZ,
      cardRoute: (id: string) => openCard({ page: "start" }, id, "rings"),
      recordRoute: (id: string) => openCard({ page: "start" }, id),
      listRoute: {
        page: "cards",
        query: { ...DEFAULT_LIST, family: block.family },
        evening: block.day,
      },
    })
  )
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// fünf Scheiben davor zu 9,0, am Freitag zwei Scheiben: 2 × 9,4 und 1 × 8,8 → Ø 9,2
const CARDS = [
  ...[20, 21, 22, 23, 24].map((d, i) =>
    lp(periodCard(`b${i}`, 0, [90], { startedAtMs: at(d, 18) }))
  ),
  lp(periodCard("a", 0, [94, 94], { startedAtMs: at(25, 18) })),
  lp(periodCard("b", 0, [88], { startedAtMs: at(25, 19) })),
]

describe("Block des letzten Abends auf Start (Plan N5, D3–D6)", () => {
  const html = render(CARDS)

  it("Satz, Meta, große Zahl, Abstand, Streifen, Kacheln, Link in der Reihenfolge", () => {
    const order = [
      "<h2",
      "Fr 25.09. · Luftpistole · 2 Scheiben · 3 Schuss",
      "data-evening-mean",
      "data-evening-delta",
      "data-form-strip",
      "data-start-card",
      "data-evening-list-link",
    ].map((marker) => html.indexOf(marker))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(text(html)).toContain("0,20 über dem Schnitt der 5 Scheiben davor.")
    expect(html).toMatch(/data-evening-mean[^>]*>9,20</)
    expect(text(html)).toContain("+0,20 zum Schnitt der 5 Scheiben davor")
  })

  it("jede Scheibe eine Kachel mit großer kleiner Scheibe, Link mit Start als Herkunft", () => {
    expect(
      [...html.matchAll(/<a href="([^"]+)"[^>]*data-start-card="([^"]+)"/g)].map((m) => [
        m[1],
        m[2],
      ])
    ).toEqual([
      ["/cards/a?from=start&amp;scoring=rings", "a"],
      ["/cards/b?from=start&amp;scoring=rings", "b"],
    ])
    expect(html).toMatch(/data-start-card="a"[\s\S]*?class="[^"]*size-14/)
    expect(text(html)).toContain("18:00 · Training 18,8 18")
  })

  it("neue Rekorde nur, wenn der Abend welche hält; der Link in die Liste mit dem Abend", () => {
    expect(html).toContain("data-new-records")
    // der Rekord öffnet in seiner Wertung (hier Zehntel, ohne Schlüssel), die Kachel in der der Kachel (Review N5)
    expect(html).toMatch(
      /Neue Rekorde[\s\S]*?<a href="\/cards\/[ab]\?from=start" aria-label="[^"]+ zeigen"[^>]*>zeigen<\/a>/
    )
    expect(html).toMatch(/aria-labelledby="evening-lp-freihand evening-lp-freihand-meta"/)
    expect(html).toMatch(
      /<a href="\/cards\?family=lp-freihand#2026-09-25"[^>]*data-evening-list-link/
    )
    // ein Abend ohne Rekord: die frühere Scheibe zu 9,5 hält jeden
    const without = render([
      lp(periodCard("best", 0, [95, 95], { startedAtMs: at(20, 18) })),
      lp(periodCard("best1", 0, [95], { startedAtMs: at(21, 18) })),
      lp(periodCard("n", 0, [90], { startedAtMs: at(25, 18) })),
      lp(periodCard("m", 0, [90, 90], { startedAtMs: at(25, 19) })),
    ])
    expect(without).not.toContain("data-new-records")
  })

  it("nur Tokens, keine Palette-Klassen, Schrift ab text-xs", () => {
    expect(html).not.toMatch(/\b(text|bg|border)-(red|green|blue|amber|slate|gray)-\d/)
    expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })
})
