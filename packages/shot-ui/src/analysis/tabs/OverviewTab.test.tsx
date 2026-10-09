import { READING_GUIDE } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { initialViewState } from "../../view-state"
import { AnalysisPanel } from "../AnalysisPanel"
import { analysisInput } from "../input"
import { observations } from "../observations"
import { overviewTiles } from "../overview"
import { fortyCard } from "../testCard"

const CARD = fortyCard()
const render = (explain = false) =>
  renderToStaticMarkup(
    createElement(AnalysisPanel, {
      shots: CARD,
      state: initialViewState(),
      target: LP_10M,
      tab: "overview",
      onTab: () => {},
      explain,
      onToggleLayer: () => {},
      onHelp: () => {},
    })
  )

describe("Reiter Überblick", () => {
  const html = render()
  const input = analysisInput(CARD, "decimal", LP_10M)

  it("acht Kacheln mit Wert und Kurzsatz aus dem Thema", () => {
    const tiles = overviewTiles(input)
    expect([...html.matchAll(/data-tile="([^"]+)"/g)].map((m) => m[1])).toEqual(
      tiles.map((t) => t.label)
    )
    for (const tile of tiles) {
      expect(html).toMatch(
        new RegExp(`data-tile="${tile.label}"[^>]*title="${helpTopic(tile.help)!.short}"`)
      )
      if (tile.value) expect(html).toContain(`>${tile.value}<`)
    }
    expect(html).toContain('<span class="normal-case">σ</span>')
  })

  it("mit „Erklärungen“ der Kurzsatz sichtbar an jeder Kachel", () => {
    expect(render(true).match(/data-short/g)).toHaveLength(8)
    expect(html).not.toContain("data-short")
  })

  it("Beobachtungen: ein Satz je Befund mit Symbol, in einer Karte mit Hilfe", () => {
    expect([...html.matchAll(/<li[^>]*data-observation="/g)]).toHaveLength(
      observations(input).length
    )
    expect(html).toMatch(/data-card="beobachtungen"/)
    expect(html).toMatch(/<button[^>]*data-help="beobachtungen"/)
  })

  it("der Einstieg aus dem Paket und ein Satz zum Schalter, anfangs zugeklappt", () => {
    expect(html).toMatch(/<details data-guide-card="true"[^>]*>/)
    expect(html).not.toMatch(/<details data-guide-card="true"[^>]*\bopen\b/)
    expect([...html.matchAll(/<li data-guide="true"/g)]).toHaveLength(READING_GUIDE.length + 1)
    for (const item of READING_GUIDE) expect(html).toContain(item.title)
  })
})
