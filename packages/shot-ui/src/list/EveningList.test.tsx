import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { LG_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { listOnEvening, openCard } from "../nav/navigate"
import { DEFAULT_LIST, type ListRoute } from "../nav/routes"
import { marksOf, NOW, periodCard, projected, TZ } from "../period/testSeason"
import { cardListModel } from "./evenings"
import { EveningList } from "./EveningList"
import { KindMark } from "./KindMark"

const LIST: ListRoute = {
  page: "cards",
  query: { ...DEFAULT_LIST, family: "lg-freihand" },
  evening: null,
}

const at = (hourUtc: number, minute = 0, day = 29) => Date.UTC(2026, 8, day, hourUtc, minute)
/** Scheiben mit Schüssen: das Modell bekommt ihre Projektion, die kleinen Scheiben ihre Lagen */
type RawInput = { card: PeriodCard; family: string; scoring?: "decimal" | "rings" }[]
const INPUT: RawInput = [
  { card: periodCard("a", 1, [100, 102, 98], { startedAtMs: at(16, 30) }), family: "lg-freihand" },
  { card: periodCard("b", 1, [101, 103], { startedAtMs: at(17, 45) }), family: "lg-freihand" },
  { card: periodCard("c", 1, [95, 97], { startedAtMs: at(18) }), family: "lp-freihand" },
  { card: periodCard("d", 3, [99], { startedAtMs: at(16, 0, 27) }), family: "lg-freihand" },
]
const FAMILIES = [
  { value: "lg-freihand", label: "Luftgewehr" },
  { value: "lp-freihand", label: "Luftpistole" },
]
const render = (
  scoring: "decimal" | "rings" = "decimal",
  input: RawInput = INPUT,
  marked: { evening?: string | null; pick?: string | null } = {}
) => {
  const model = cardListModel(
    input.map((c) => ({
      family: c.family,
      card: { ...projected(c.card), ...(c.scoring ? { scoring: c.scoring } : {}) },
    })),
    { ...DEFAULT_LIST, family: "lg-freihand" },
    { timeZone: TZ, nowMs: NOW, named: [], scoring }
  )
  return renderToStaticMarkup(
    h(EveningList, {
      model,
      marks: marksOf(input.map((c) => c.card)),
      target: LG_10M,
      families: FAMILIES,
      timeZone: TZ,
      cardRoute: (id: string) => openCard(LIST, id),
      otherFamilyRoute: (family: string, day: string) =>
        listOnEvening({ ...DEFAULT_LIST, family: "lg-freihand" }, family, day),
      ...marked,
    })
  )
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("Scheiben-Liste nach Abend (Form wie die Liste eines Zeitraums)", () => {
  const html = render()

  it("je Monat eine Karte mit Kopf und Tabelle; je Abend eine Gruppe mit Anker, das Datum einmal", () => {
    expect(html).toMatch(/<section data-month="2026-09"[^>]*aria-labelledby="month-2026-09"/)
    expect(html).toMatch(/<h2 id="month-2026-09" class="font-display[^"]*">September 2026<\/h2>/)
    expect(text(html)).toContain("September 2026 3 Scheiben · 6 Schuss")
    expect(html).toMatch(/rounded-2xl border border-border bg-card[^"]*"><table/)
    expect([...html.matchAll(/<tbody id="([^"]+)" data-evening="\1"/g)].map((m) => m[1])).toEqual([
      "2026-09-29",
      "2026-09-27",
    ])
    // das Datum steht einmal je Abend, jede Zeile hat ihre Zelle (kein rowSpan: das Hervorheben bleibt ein
    // Rechteck); keine Zahl der Scheiben und Schüsse je Abend; der Hinweis rechtsbündig in eigener Zeile
    expect(html).toMatch(/<th scope="row"[^>]*>Di 29\.09\.<\/th>/)
    expect(html).toMatch(/<th scope="row"[^>]*>So 27\.09\.<\/th>/)
    expect(html.match(/scope="row"/g)).toHaveLength(2)
    expect(html).not.toContain("rowSpan")
    expect(html).toMatch(
      /<tr data-card-row="a"[^>]*><td class="px-1 py-1 @min-\[32rem\]:px-2"><\/td>/
    )
    expect(html).toMatch(/<td colSpan="9" class="[^"]*text-right"><a [^>]*data-other-family/)
    expect(text(html)).not.toMatch(/\d Scheiben? · \d+ Schuss auch/)
    for (const head of [
      "Datum",
      "Uhrzeit",
      "Art",
      "Ganze Ringe",
      "Zehntel",
      "Ø je Schuss",
      "zum Schnitt",
      "Schuss",
    ])
      expect(html, head).toMatch(new RegExp(`<th scope="col"[^>]*>${head}</th>`))
  })

  it("Mischabend: der Hinweis nennt die andere Familie mit Namen und Zahl", () => {
    expect(html).toMatch(
      /<a href="\/cards\?family=lp-freihand#2026-09-29" data-other-family="lp-freihand"[^>]*>auch 1 Scheibe Luftpistole ›</
    )
    expect(html.match(/data-other-family=/g)).toHaveLength(1)
  })

  it("Zeilen neueste zuerst: Uhrzeit, Art, Ergebnis, Ø, Abstand, Schuss; die kleine Scheibe ist der Knopf", () => {
    expect([...html.matchAll(/data-card-row="([^"]+)"/g)].map((m) => m[1])).toEqual(["b", "a", "d"])
    expect(html).toMatch(
      /<tr data-card-row="b"[^>]*><th[^>]*>[^<]*<\/th><td[^>]*><a href="\/cards\/b\?from=list&amp;family=lg-freihand" aria-label=/
    )
    const rowA = html.slice(html.indexOf('data-card-row="a"'), html.indexOf('data-card-row="d"'))
    // die Art ohne Kürzel: Training hat kein Zeichen, nur den Namen für den Screenreader
    expect(text(rowA)).toContain("18:30 Training")
    expect(rowA).toContain('<span class="sr-only">Training</span>')
    expect(rowA).not.toMatch(/>T</)
    // Ergebnis mit Namen der Wertung: Spalten „Ringe“ und „Zehntel“, ohne Wertung der Scheibe keine fett
    expect(rowA).toMatch(/data-rings[^>]*>29</)
    expect(rowA).toMatch(/data-decimal[^>]*>30,0</)
    expect(rowA).not.toContain("data-card-scoring")
    expect(html).toMatch(/<th[^>]*>Ganze Ringe<\/th><th[^>]*>Zehntel<\/th>/)
    expect(html).not.toMatch(/<th[^>]*>Ergebnis<\/th>/)
    expect(rowA).toMatch(/data-mean[^>]*>10,00</)
    expect(rowA).toContain("<svg")
    // vor b liegen d (1 Schuss 9,9) und a (3 Schuss 10,0), über die Schüsse 39,9/4 = 9,975: 10,2 − 9,975 = +0,225,
    // gerundet +0,23 (als Mittel der Scheiben wären es +0,25); vor a nur d: +0,10
    const rowB = html.slice(html.indexOf('data-card-row="b"'))
    expect(rowB).toMatch(/data-delta[^>]*>\+0,23</)
    expect(rowA).toMatch(/data-delta[^>]*>\+0,10</)
    // der Knopf nennt die Werte mit ihrer Bedeutung und dem Datum
    expect(html).toContain(
      'aria-label="Di 29.09.2026, 18:30, Training, Ergebnis 30,0 in Zehnteln, 29 in ganzen Ringen, Ø 10,00 je Schuss, +0,10 zum Schnitt davor, 3 Schuss"'
    )
  })

  it("in ganzen Ringen das ganzzahlige Ergebnis; ein Abstand unter null mit echtem Minus", () => {
    // die Spalten bleiben, die Wertung der Liste ändert nur Ø und Abstand
    expect(render("rings")).toMatch(
      /data-card-row="a"[\s\S]*?data-rings[^>]*>29<[\s\S]*?data-decimal[^>]*>30,0</
    )
    expect(render("rings")).toContain("Ergebnis 29 in ganzen Ringen, 30,0 in Zehnteln, Ø")
  })

  it("die Wertung der Scheibe ist fett und heißt im Namen des Links so, ohne Zeile unter dem Monat", () => {
    const official = render("decimal", [
      {
        card: periodCard("o", 1, [100, 102, 98], { official: "rings", startedAtMs: at(16, 30) }),
        family: "lg-freihand",
      },
    ])
    // ohne Wertung der Scheibe: die amtliche
    expect(official).toMatch(
      /<td data-rings="true" data-card-scoring="true" class="[^"]*font-semibold[^"]*">29</
    )
    expect(official).toMatch(/<td data-decimal="true" class="(?![^"]*font-semibold)[^"]*">30,0</)
    // keine Zeile „Fett: Wertung der Scheibe.“ unter dem Monat
    expect(official).not.toContain("Fett:")
    expect(official).not.toContain("data-card-scoring-legend")
    expect(official).toContain(
      "Ergebnis 29 in ganzen Ringen (Wertung der Scheibe), 30,0 in Zehnteln"
    )
    // gewählt in Zehnteln, obwohl amtlich ganze Ringe: Zehntel fett und vorn
    const chosen = render("rings", [
      {
        card: periodCard("o", 1, [100, 102, 98], { official: "rings", startedAtMs: at(16, 30) }),
        family: "lg-freihand",
        scoring: "decimal",
      },
    ])
    expect(chosen).toMatch(
      /<td data-decimal="true" data-card-scoring="true" class="[^"]*font-semibold[^"]*">30,0</
    )
    expect(chosen).toMatch(/<td data-rings="true" class="(?![^"]*font-semibold)[^"]*">29</)
    expect(chosen).toContain("Ergebnis 30,0 in Zehnteln (Wertung der Scheibe), 29 in ganzen Ringen")
    const lower = render("decimal", [
      { card: periodCard("x", 2, [103]), family: "lg-freihand" },
      { card: periodCard("y", 1, [100]), family: "lg-freihand" },
    ])
    expect(lower).toMatch(/data-delta[^>]*>−0,30</)
  })

  it("Telefon: Uhrzeit, Abstand und Schuss erst ab 32rem Breite (Container), keine Palette-Klassen", () => {
    expect(html).toContain("@container")
    expect(html.match(/hidden @min-\[32rem\]:table-cell/g)).toHaveLength(3 + 3 * 3)
    expect(html).not.toMatch(/\b(text|bg|border)-(red|green|blue|emerald|amber|slate|gray)-\d/)
    expect(html).not.toContain("dark:")
  })

  it("jede kleine Scheibe zeichnet die Lagen ihrer eigenen Zeile; ein Schuss ohne Wert gestrichelt", () => {
    const edge = /stroke="var\(--shot-edge\)"/g
    const row = (html: string, id: string) => {
      const start = html.indexOf(`data-card-row="${id}"`)
      const next = html.indexOf("data-card-row=", start + 1)
      return html.slice(start, next < 0 ? undefined : next)
    }
    const withoutValue = periodCard("n", 2, [100, 101, 99, 102], { startedAtMs: at(19) })
    const placeholder: PeriodCard = {
      ...withoutValue,
      shots: withoutValue.shots.map((shot, i) =>
        i === 1 ? { ...shot, ring: null, decimalTenths: null } : shot
      ),
    }
    const html = render("decimal", [...INPUT, { card: placeholder, family: "lg-freihand" }])
    expect(row(html, "a").match(edge)).toHaveLength(3)
    expect(row(html, "b").match(edge)).toHaveLength(2)
    expect(row(html, "d").match(edge)).toHaveLength(1)
    expect(row(html, "n").match(edge)).toHaveLength(4)
    expect(row(html, "n").match(/stroke-dasharray="2 2"/g)).toHaveLength(1)
    expect(row(html, "a")).not.toContain("stroke-dasharray")
  })

  it("markiert, wohin man kommt: die Zeilen des Abends aus dem Anker, die Scheibe aus `pick`", () => {
    const tr = (html: string) =>
      [...html.matchAll(/<tr data-card-row="([^"]+)"([^>]*)>/g)].map(([, id, rest]) => ({
        id,
        marked: rest.includes("data-marked") && rest.includes("bg-accent-wash"),
        current: rest.includes('aria-current="true"'),
      }))
    // a und b am 29.09., d am 27.09.
    expect(tr(render("decimal", INPUT, { evening: "2026-09-29" }))).toEqual([
      { id: "b", marked: true, current: false },
      { id: "a", marked: true, current: false },
      { id: "d", marked: false, current: false },
    ])
    // a teilt den Abend mit b: nur a ist markiert, nicht der ganze Abend
    expect(tr(render("decimal", INPUT, { pick: "a" })).filter((r) => r.marked)).toEqual([
      { id: "a", marked: true, current: true },
    ])
    const picked = render("decimal", INPUT, { pick: "a" })
    expect(picked).toMatch(/<a href="\/cards\/a[^"]*"[^>]*aria-current="true"/)
    expect(picked).not.toMatch(/data-marked[^>]*class="[^"]*hover:bg-surface-2/)
    expect(tr(render()).some((r) => r.marked || r.current)).toBe(false)
  })

  it("ohne Scheiben ein Satz statt einer leeren Liste", () => {
    expect(text(render("decimal", []))).toBe("Keine Scheiben für diese Filter.")
  })
})

describe("KindMark: der Pokal gold und gut zu sehen", () => {
  it("Wettkampf als goldener Pokal in 16 px, Training ohne Zeichen", () => {
    const competition = renderToStaticMarkup(h(KindMark, { kind: "competition" }))
    expect(competition).toMatch(/lucide-trophy[^"]*\bsize-4\b[^"]*\btext-gold\b/)
    expect(renderToStaticMarkup(h(KindMark, { kind: "training" }))).not.toContain("<svg")
  })
})
