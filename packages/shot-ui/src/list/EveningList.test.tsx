import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DEFAULT_LIST } from "../nav/routes"
import { NOW, periodCard, TZ } from "../period/testSeason"
import { cardListModel, type ListInputCard } from "./evenings"
import { EveningList } from "./EveningList"

const at = (hourUtc: number, minute = 0, day = 29) => Date.UTC(2026, 8, day, hourUtc, minute)
const INPUT: ListInputCard[] = [
  { card: periodCard("a", 1, [100, 102, 98], { startedAtMs: at(16, 30) }), family: "lg-freihand" },
  { card: periodCard("b", 1, [101, 103], { startedAtMs: at(17, 45) }), family: "lg-freihand" },
  { card: periodCard("c", 1, [95, 97], { startedAtMs: at(18) }), family: "lp-freihand" },
  { card: periodCard("d", 3, [99], { startedAtMs: at(16, 0, 27) }), family: "lg-freihand" },
]
const FAMILIES = [
  { value: "lg-freihand", label: "Luftgewehr" },
  { value: "lp-freihand", label: "Luftpistole" },
]
const render = (scoring: "decimal" | "rings" = "decimal", input = INPUT) => {
  const model = cardListModel(
    input,
    { ...DEFAULT_LIST, family: "lg-freihand" },
    { timeZone: TZ, nowMs: NOW, named: [], scoring }
  )
  return renderToStaticMarkup(
    h(EveningList, {
      model,
      cards: new Map<string, PeriodCard>(input.map((c) => [c.card.id, c.card])),
      target: LG_10M,
      families: FAMILIES,
      scoring,
      timeZone: TZ,
      onOpen: () => {},
      onFamily: () => {},
    })
  )
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("Scheiben-Liste nach Abend (Plan N2, D2–D6)", () => {
  const html = render()

  it("ein Abschnitt je Abend mit Anker, neueste zuerst, Kopf mit Wochentag, Zahl und Schüssen", () => {
    expect([...html.matchAll(/data-evening="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "2026-09-29",
      "2026-09-27",
    ])
    expect(html).toMatch(/<section[^>]*id="2026-09-29"[^>]*data-evening="2026-09-29"/)
    expect(text(html)).toContain("Di 29.09.2026 2 Scheiben · 5 Schuss")
    expect(text(html)).toContain("So 27.09.2026 1 Scheibe · 1 Schuss")
  })

  it("Mischabend: der Hinweis nennt die andere Familie mit Namen und Zahl", () => {
    expect(html).toMatch(/data-other-family="lp-freihand"[^>]*>auch 1 Scheibe Luftpistole ›</)
    expect(html.match(/data-other-family=/g)).toHaveLength(1)
  })

  it("Zeilen in zeitlicher Folge: Uhrzeit, Art, Ergebnis, Ø, Abstand, Schuss; die Zeile ist der Knopf", () => {
    expect([...html.matchAll(/data-card-row="([^"]+)"/g)].map((m) => m[1])).toEqual(["a", "b", "d"])
    expect(html).toMatch(/<button type="button" data-card-row="a"/)
    const rowA = html.slice(html.indexOf('data-card-row="a"'), html.indexOf('data-card-row="b"'))
    expect(text(rowA)).toContain("18:30")
    expect(text(rowA)).toContain("T Training")
    expect(rowA).toMatch(/data-result[^>]*>30,0</)
    expect(rowA).toMatch(/data-mean[^>]*>10,00</)
    expect(rowA).toContain("<svg")
    // vor b liegen d (9,9) und a (10,0): 10,2 − 9,95 = +0,25; vor a nur d: +0,10
    const rowB = html.slice(html.indexOf('data-card-row="b"'))
    expect(rowB).toMatch(/data-delta[^>]*>\+0,25</)
    expect(rowA).toMatch(/data-delta[^>]*>\+0,10</)
  })

  it("in ganzen Ringen das ganzzahlige Ergebnis; ein Abstand unter null mit echtem Minus", () => {
    expect(render("rings")).toMatch(/data-card-row="a"[\s\S]*?data-result[^>]*>29</)
    const lower = render("decimal", [
      { card: periodCard("x", 2, [103]), family: "lg-freihand" },
      { card: periodCard("y", 1, [100]), family: "lg-freihand" },
    ])
    expect(lower).toMatch(/data-delta[^>]*>−0,30</)
  })

  it("Telefon: Uhrzeit, Abstand und Schuss erst ab 32rem Breite (Container), keine Palette-Klassen", () => {
    expect(html).toContain("@container")
    expect(html).toContain("hidden @min-[32rem]:block")
    expect(html).not.toMatch(/\b(text|bg|border)-(red|green|blue|emerald|amber|slate|gray)-\d/)
    expect(html).not.toContain("dark:")
  })

  it("ohne Scheiben ein Satz statt einer leeren Liste", () => {
    expect(text(render("decimal", []))).toBe("Keine Scheiben für diese Filter.")
  })
})
