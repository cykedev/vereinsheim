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
      // Namen wie „Eingeschossen?“ enthalten Zeichen, die in einem Muster etwas bedeuten
      const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      expect(html).toMatch(
        new RegExp(
          `data-tile="${literal(tile.label)}"[^>]*title="${literal(helpTopic(tile.help)!.short)}"`
        )
      )
      if (tile.value) expect(html).toContain(`>${tile.value}<`)
    }
    // Alltagswort auf der Kachel, σ steht im Blatt
    expect(html).not.toContain('<span class="normal-case">σ</span>')
    expect(html).toContain('data-tile="Streuung"')
  })

  it("jede Kachel mit „?“ zu ihrem Thema (die Zahlen-Ansicht der Seite)", () => {
    const tiles = overviewTiles(input)
    const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    for (const tile of tiles)
      expect(html).toMatch(
        new RegExp(
          `<button type="button" aria-label="Erklärung: ${literal(tile.label)}" data-help="${literal(tile.help)}"`
        )
      )
    // ohne `onHelp` kein „?“
    const bare = renderToStaticMarkup(
      createElement(AnalysisPanel, {
        shots: CARD,
        state: initialViewState(),
        target: LP_10M,
        tab: "overview",
        onTab: () => {},
        explain: false,
        onToggleLayer: () => {},
      })
    )
    for (const tile of tiles) expect(bare).not.toContain(`aria-label="Erklärung: ${tile.label}"`)
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
