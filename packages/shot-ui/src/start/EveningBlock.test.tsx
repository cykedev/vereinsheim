import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { openCard } from "../nav/navigate"
import { DEFAULT_LIST } from "../nav/routes"
import { centred, marksOf, miniViews, NOW, periodCard, projected, TZ } from "../period/testSeason"
import { EveningBlock } from "./EveningBlock"
import { startModel } from "./model"

const at = (day: number, hour: number) => Date.UTC(2026, 8, day, hour - 2)
/** Scheiben mit Schüssen: das Modell bekommt ihre Projektion, die kleinen Scheiben ihre Lagen */
type Raw = { card: PeriodCard; family: string }
const lp = (card: PeriodCard): Raw => ({ card, family: "lp-freihand" })
const render = (
  cards: Raw[],
  scoring: "decimal" | "rings" = "decimal",
  extra: {
    actions?: ReturnType<typeof h>
    notice?: ReturnType<typeof h>
    moreRecords?: number
  } = {}
) => {
  const model = startModel({
    cards: cards.map((c) => ({ ...c, card: projected(c.card) })),
    timeZone: TZ,
    nowMs: NOW,
    named: [],
    scoringOf: () => scoring,
    family: null,
  })
  const { moreRecords, ...props } = extra
  const block = {
    ...model.blocks[0],
    ...(moreRecords === undefined ? {} : { moreRecords }),
  }
  return renderToStaticMarkup(
    h(EveningBlock, {
      block,
      familyLabel: "Luftpistole",
      marks: marksOf(cards.map((c) => c.card)),
      target: LP_10M,
      timeZone: TZ,
      cardRoute: (id: string) => openCard({ page: "start" }, id),
      recordRoute: (id: string, scoring: "decimal" | "rings") =>
        openCard({ page: "start" }, id, scoring),
      listRoute: {
        page: "cards",
        query: { ...DEFAULT_LIST, family: block.family },
        evening: block.day,
      },
      ...props,
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

describe("Block des letzten Abends auf Start", () => {
  const html = render(CARDS)

  it("Satz, Meta, große Zahl, Abstand, Streifen, Kacheln, Link in der Reihenfolge", () => {
    const order = [
      "<h2",
      "Fr 25.09. · 2 Scheiben · 3 Schuss",
      "data-evening-sentence",
      "data-evening-mean",
      "data-evening-reference",
      "data-form-strip",
      "data-start-card",
      "data-evening-list-link",
    ].map((marker) => html.indexOf(marker))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(text(html)).toContain("0,20 über dem Schnitt der 5 Scheiben davor.")
    expect(html).toMatch(/data-evening-mean[^>]*>9,20</)
    // jeder Block rechnet in der Wertung seiner Familie und nennt sie
    expect(text(html)).toContain("9,20 Ø je Schuss in Zehnteln")
    expect(text(render(CARDS, "rings"))).toContain("Ø je Schuss in ganzen Ringen")
    // mit dem Kreis daneben nennt der Kreis die Wertung; ein Hinweis darunter
    const withToggle = render(CARDS, "decimal", {
      actions: h("span", { "data-kreis": true }),
      notice: h("p", { role: "alert" }, "HINWEIS"),
    })
    expect(text(withToggle)).toContain("9,20 Ø je Schuss")
    expect(text(withToggle)).not.toContain("in Zehnteln")
    expect(withToggle).toMatch(
      /data-evening-mean[\s\S]*?<\/p><div data-evening-actions[^>]*><span data-kreis/
    )
    // der Hinweis unter Zahl und Bezug, vor dem Verlauf
    expect(withToggle.indexOf("HINWEIS")).toBeGreaterThan(
      withToggle.indexOf("data-evening-reference")
    )
    expect(withToggle.indexOf("HINWEIS")).toBeLessThan(withToggle.indexOf("data-form-strip"))
    // der Bezug statt des Abstands, der schon im Satz steht
    expect(text(html)).toContain("Schnitt der 5 Scheiben davor: 9,00")
    expect(text(html)).not.toContain("+0,20 zum Schnitt")
  })

  it("eine Legende unter dem Verlauf, der Satz zum Band nur mit Band", () => {
    // zwölf Scheiben davor geben das Band (ab zehn), die sieben aus CARDS nicht
    const many = [
      ...Array.from({ length: 12 }, (_, i) =>
        lp(periodCard(`m${i}`, 0, [88 + (i % 4)], { startedAtMs: at(8 + i, 18) }))
      ),
      lp(periodCard("a", 0, [94, 94], { startedAtMs: at(25, 18) })),
    ]
    expect(render(many)).toMatch(
      /data-form-strip[\s\S]*?<p data-form-legend[^>]*>Grau: deine letzten Scheiben\. Die Linie ist der Schnitt der jeweils letzten fünf \(gestrichelt, solange es weniger sind\)\. Das Band zeigt deine übliche Schwankung\.<\/p>/
    )
    expect(html).toMatch(
      /<p data-form-legend[^>]*>Grau: deine letzten Scheiben\. Die Linie ist der Schnitt der jeweils letzten fünf \(gestrichelt, solange es weniger sind\)\.<\/p>/
    )
    // ab der fünften Scheibe im Streifen ohne gestrichelten Teil kein Wort dazu
    const full = Array.from({ length: 25 }, (_, i) =>
      lp(periodCard(`f${i}`, 0, [88 + (i % 4)], { startedAtMs: at(1, 18) + i * 86_400_000 }))
    )
    expect(render(full)).toMatch(
      /<p data-form-legend[^>]*>Grau: deine letzten Scheiben\. Die Linie ist der Schnitt der jeweils letzten fünf\. Das Band/
    )
    // ohne graue Punkte (nur der Abend) und ohne Band nichts zu erklären
    const lone = render([lp(periodCard("a", 0, [94, 94], { startedAtMs: at(25, 18) }))])
    expect(lone).not.toContain("data-form-legend")
    // ohne Wert des Abends kein Bezug unter dem Strich
    const blind = render([
      ...CARDS.slice(0, 5),
      lp(periodCard("a", 0, [], { startedAtMs: at(25, 18) })),
    ])
    expect(blind).not.toContain("data-evening-reference")
    // das Datum des Abends steht im Verlauf, nicht „Abend“
    expect(html).toMatch(/data-evening-label="true"[^>]*>Fr 25\.09\.</)
  })

  it("die Kacheln nennen die Wertung beim Namen des Schalters: „18,8 Zehntel · 18 ganze Ringe“", () => {
    const tile = html.slice(html.indexOf('data-start-card="a"'))
    const tileText = text(tile.slice(0, tile.indexOf("</a>")))
    expect(tileText).toMatch(/\d+,\d Zehntel · \d+ ganze Ringe$/)
    expect(tile).toMatch(/aria-label="[^"]*Ergebnis \d+,\d Zehntel, \d+ ganze Ringe"/)
    // umbrechen nur zwischen den Wertungen, jede bleibt zusammen (kein „ganze / Ringe“ bei 1280 px)
    expect(tile).toMatch(/<span data-start-result="true" class="[^"]*flex-wrap/)
    expect(tile).toMatch(/<span class="whitespace-nowrap"><span data-result/)
    expect(tile).toMatch(/<span data-other-result="true" class="[^"]*whitespace-nowrap/)
  })

  it("die Disziplin steht als Überschrift oben im Block, mit dem Symbol der Disziplinen", () => {
    expect(html).toMatch(
      /<h2 id="evening-lp-freihand"[^>]*>[\s\S]*?<svg[\s\S]*?<\/svg>Luftpistole<\/h2>/
    )
    expect(html).toMatch(/<h2[^>]*class="[^"]*text-\[17px\][^"]*font-semibold/)
    // der Satz bleibt groß, aber nicht die Überschrift
    expect(html).toMatch(
      /<p data-evening-sentence="true" class="font-display[^"]*">0,20 über dem Schnitt/
    )
  })

  it("jede Scheibe eine Kachel mit großer kleiner Scheibe, Link mit Start als Herkunft", () => {
    expect(
      [...html.matchAll(/<a href="([^"]+)"[^>]*data-start-card="([^"]+)"/g)].map((m) => [
        m[1],
        m[2],
      ])
    ).toEqual([
      ["/cards/a?from=start", "a"],
      ["/cards/b?from=start", "b"],
    ])
    expect(html).toMatch(/data-start-card="a"[\s\S]*?class="[^"]*size-14/)
    expect(text(html)).toContain("18:00 · Training 18,8 Zehntel · 18 ganze Ringe")
  })

  it("Kacheln einer Zeile teilen zwei Zeilen: Uhrzeit und Art, darunter das Ergebnis auf einer Linie, auch wenn ein Text umbricht", () => {
    for (const id of ["a", "b"]) {
      const start = html.indexOf(`data-start-card="${id}"`)
      const li = html.slice(html.lastIndexOf("<li", start), start)
      expect(li).toMatch(/^<li class="[^"]*\brow-span-2\b[^"]*\bgrid-rows-subgrid\b/)
      const link = html.match(new RegExp(`<a [^>]*data-start-card="${id}"[^>]*>`))![0]
      expect(link).toMatch(/class="[^"]*\brow-span-2\b/)
      expect(link).toMatch(/class="[^"]*\bgrid-rows-subgrid\b/)
      // die kleine Scheibe oben über beide Zeilen, daneben die Zeilen in ihrer Folge
      const tile = html.slice(start, html.indexOf("</a>", start))
      expect(tile).toMatch(
        /^[^>]*><svg [^>]*class="[^"]*\brow-span-2\b[^"]*\bself-start\b[\s\S]*<\/svg><span data-start-meta="true"[\s\S]*<span data-start-result="true"/
      )
    }
  })

  it("jede Kachel zeichnet die Lagen ihrer eigenen Scheibe", () => {
    const tile = (id: string) => {
      const start = html.indexOf(`data-start-card="${id}"`)
      return html.slice(start, html.indexOf("</a>", start))
    }
    expect(tile("a").match(/stroke="var\(--shot-edge\)"/g)).toHaveLength(2)
    expect(tile("b").match(/stroke="var\(--shot-edge\)"/g)).toHaveLength(1)
  })

  it("neue Rekorde nur, wenn der Abend welche hält; der Link in die Liste mit dem Abend", () => {
    expect(html).toContain("data-new-records")
    // der Rekord öffnet in seiner Wertung (hier Zehntel, ohne Schlüssel), die Kachel in der der Kachel
    expect(html).toMatch(
      /Neue Rekorde[\s\S]*?: <span[\s\S]*?<a href="\/cards\/[ab]\?from=start&amp;scoring=decimal" aria-label="[^"]+: [^"]+ zeigen"[^>]*>zeigen<\/a>/
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

  it("mehr als fünf neue Rekorde: der Rest als Link in den Fortschritt, Einzahl und Mehrzahl", () => {
    const more = (moreRecords: number) => render(CARDS, "decimal", { moreRecords })
    expect(more(3)).toMatch(
      /<a href="\/progress\?family=lp-freihand#analysis"[^>]*data-more-records[^>]*>Noch 3 weitere Rekorde im Fortschritt ›<\/a>/
    )
    expect(more(1)).toContain(">Noch 1 weiterer Rekord im Fortschritt ›</a>")
    expect(more(0)).not.toContain("data-more-records")
  })

  it("nur Tokens, keine Palette-Klassen, Schrift ab text-xs", () => {
    expect(html).not.toMatch(/\b(text|bg|border)-(red|green|blue|amber|slate|gray)-\d/)
    expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })
})

describe("Kleine Scheiben auf Start", () => {
  it("stehen um die Mitte, der Spiegel in jeder Kachel gleich groß", () => {
    // ab der ersten Kachel: Symbol und Verlauf davor zählen nicht
    const html = render(CARDS)
    const tiles = miniViews(html.slice(html.indexOf("data-start-card")))
    // Treffer auf 0 bis 0,1 mm, also der Ausschnitt des Spiegels: 29,75 · 1,6 · 2 = 95,2
    expect(tiles).toHaveLength(2)
    expect(tiles.every(centred)).toBe(true)
    expect(tiles.every((v) => Math.abs(v.w - 95.2) < 0.001)).toBe(true)
  })
})

describe("Grundlage, Grund und Herkunft auf Start", () => {
  const SERIES = {
    series: [1, 2, 3, 4].map((series) => ({ series, shots: 10, rings: 96, decimalTenths: 1000 })),
    total: null,
    center: null,
  }
  const model = startModel({
    cards: [
      {
        card: projected(periodCard("m", 0, [101, 99], { startedAtMs: at(29, 18) })),
        family: "lp-freihand",
      },
      {
        card: projected({ ...periodCard("s", 0, [], { startedAtMs: at(29, 19) }), sums: SERIES }),
        family: "lp-freihand",
        provenance: "entered",
      },
      {
        card: projected(periodCard("w", 0, [], { startedAtMs: at(29, 20) })),
        family: "lp-freihand",
        provenance: "printout",
      },
    ],
    timeZone: TZ,
    nowMs: NOW,
    named: [],
    scoringOf: () => "decimal",
    family: null,
  })
  const block = model.blocks[0]
  const html = (onHelp?: (id: string) => void) =>
    renderToStaticMarkup(
      h(EveningBlock, {
        block,
        familyLabel: "Luftpistole",
        marks: new Map(),
        target: LP_10M,
        timeZone: TZ,
        cardRoute: (id: string) => openCard({ page: "start" }, id),
        recordRoute: (id: string, scoring: "decimal" | "rings") =>
          openCard({ page: "start" }, id, scoring),
        listRoute: {
          page: "cards",
          query: { ...DEFAULT_LIST, family: block.family },
          evening: block.day,
        },
        onHelp,
      })
    )
  const tile = (id: string) => {
    const page = html()
    const start = page.indexOf(`data-start-card="${id}"`)
    return page.slice(start, page.indexOf("</a>", start))
  }

  it("unter der Zahl die Grundlage, mit „?“ nur mit `onHelp`", () => {
    expect(html()).toMatch(
      /data-evening-basis="true"[^>]*>über 2 von 3 Scheiben · 1 wartet auf die Anlage/
    )
    expect(html()).not.toContain('data-help="grundlage"')
    expect(html(() => {})).toContain('data-help="grundlage"')
  })

  it("die Kachel einer wartenden: „–“ mit Grund, die Herkunft in der Zeile", () => {
    expect(tile("w")).toMatch(/data-start-meta="true"[^>]*>[^<]* · Training · vom Ausdruck</)
    expect(tile("w")).toContain("wartet auf die Anlage")
    expect(tile("w")).toMatch(/aria-label="[^"]*vom Ausdruck, Ergebnis – \(wartet auf die Anlage\)/)
    expect(tile("s")).toMatch(/ · eingetragen</)
    expect(tile("m")).not.toMatch(/gemessen/)
  })

  it("ein neuer Rekord einer eingetragenen Scheibe nennt die Herkunft leise", () => {
    const records = html().slice(html().indexOf("data-new-records"))
    expect(records).toMatch(/Bestes Ergebnis, Scheibe zu 40 Schuss: [^·]*· eingetragen/)
  })
})
