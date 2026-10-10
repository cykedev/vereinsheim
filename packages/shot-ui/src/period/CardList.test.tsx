import { metricByKey } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DEFAULT_LIST, type ListRoute } from "../nav/routes"
import { CardList } from "./CardList"
import { periodModel } from "./model"
import { initialPeriodState } from "./state"
import { NOW, periodCard, projected, TZ } from "./testSeason"

const metric = metricByKey("result.decimalMean")!
const render = (count: number, chosen: string | null = null, showAll?: ListRoute) => {
  const cards = Array.from({ length: count }, (_, i) =>
    periodCard(`k${i}`, 40 - i, [90 + i, 90 + i], { kind: i === 2 ? "competition" : "training" })
  )
  const model = periodModel({
    cards: cards.map(projected),
    state: initialPeriodState({ family: "lg-10m" }),
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })
  return renderToStaticMarkup(
    createElement(CardList, {
      cards: model.cards,
      values: model.values,
      deltas: model.deltas,
      metric,
      timeZone: TZ,
      chosen,
      onChoose: () => {},
      showAll,
    })
  )
}

describe("Liste der Scheiben (D10)", () => {
  it("neueste oben, mit Art, Wert, Abstand zum Schnitt davor und Schusszahl", () => {
    const html = render(4)
    expect([...html.matchAll(/data-card-row="(k\d)"/g)].map((m) => m[1])).toEqual([
      "k3",
      "k2",
      "k1",
      "k0",
    ])
    // k3 hat 9,3; die drei davor 9,0 / 9,1 / 9,2 → Schnitt 9,1, Abstand +0,20
    expect(html).toMatch(/data-card-row="k3"[\s\S]*?9,30[\s\S]*?\+0,20[\s\S]*?>2</)
    // die erste Scheibe hat keinen Schnitt davor
    expect(html).toMatch(/data-card-row="k0"[\s\S]*?9,00<\/td><td[^>]*>–</)
    expect(html).toMatch(/data-card-row="k2"[\s\S]*?data-kind="competition"/)
    // Art ohne Kürzel (U3, D7): der Wettkampf als Pokal, ein Training ohne Zeichen
    const rowOf = (id: string) =>
      html.slice(html.indexOf(`data-card-row="${id}"`)).split("</tr>")[0]
    expect(rowOf("k2")).toContain("lucide-trophy")
    expect(rowOf("k1")).not.toContain("lucide-trophy")
    expect(rowOf("k1")).toContain('<span class="sr-only">Training</span>')
    expect(html).not.toMatch(/aria-hidden="true">[TWP]</)
  })

  it("die gewählte Zeile ist markiert", () => {
    const html = render(4, "k1")
    expect(html).toMatch(/data-card-row="k1" data-chosen="true"/)
    expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(1)
  })

  it("auf dem Telefon zehn Zeilen und „Alle zeigen“, die gewählte bleibt sichtbar", () => {
    const html = render(12, "k0")
    expect([...html.matchAll(/<tr[^>]*class="[^"]*max-md:hidden/g)]).toHaveLength(1)
    expect(html).toContain("Alle 12 zeigen")
    expect(render(10)).not.toContain("zeigen</button>")
  })

  it("„Alle in Scheiben zeigen“ nur mit Ziel, als Link; sonst bleibt die Liste gleich (Plan N2, D8; N3)", () => {
    expect(render(4)).not.toContain("data-show-all")
    const html = render(4, null, {
      page: "cards",
      query: { ...DEFAULT_LIST, family: "lg-freihand" },
      evening: null,
    })
    expect(html).toMatch(
      /<a href="\/cards\?family=lg-freihand" data-show-all="true"[^>]*>Alle in Scheiben zeigen<\/a>/
    )
    expect(html.replace(/<a[^>]*data-show-all[^]*?<\/a>/, "")).toBe(render(4))
  })
})
