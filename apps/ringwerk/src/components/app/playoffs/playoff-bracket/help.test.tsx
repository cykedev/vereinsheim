import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"

import { PlayoffBracket } from "../PlayoffBracket"
import { BracketSlot } from "./BracketSlot"
import { RoundDetail } from "./RoundDetail"
import type { PlayoffCardConfig } from "../playoff-match-card"

// die Karten der Runden nutzen den Router; im Markup-Test genügt ein Stellvertreter
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}))

const config: PlayoffCardConfig = {
  scoringType: "WHOLE",
  shotsPerSeries: 10,
  playoffBestOf: 5,
  finalePrimary: "RINGS",
  finaleTiebreaker1: null,
  finaleTiebreaker2: null,
}

describe("Playoffs — Hilfe", () => {
  it("die Überschrift einer Runde trägt das „?“ nur, wenn ein Thema dazu gehört", () => {
    const props = { title: "Finale", matches: [], canManage: false, config }
    expect(
      renderToStaticMarkup(createElement(RoundDetail, { ...props, help: "finale" }))
    ).toContain('data-help="finale"')
    expect(renderToStaticMarkup(createElement(RoundDetail, props))).not.toContain("data-help")
  })

  it("das „?“ zu den Playoffs steht in einer eigenen Zeile vor dem Baum, nicht bei den Rundennamen", () => {
    const person = (id: string) => ({ id, firstName: "F", lastName: id })
    const semi = (id: string, a: string, b: string): PlayoffMatchItem => ({
      id,
      round: "SEMI_FINAL",
      participantA: person(a),
      participantB: person(b),
      winsA: 0,
      winsB: 0,
      status: "PENDING",
      duels: [],
      canCorrect: true,
    })
    const bracket: PlayoffBracketData = {
      competitionId: "c",
      eighthFinals: [],
      quarterFinals: [],
      semiFinals: [semi("h1", "Ahorn", "Esche"), semi("h2", "Birke", "Linde")],
      final: null,
    }
    const render = (semiFinals: PlayoffMatchItem[]) =>
      renderToStaticMarkup(
        createElement(PlayoffBracket, {
          bracket: { ...bracket, semiFinals },
          canManage: false,
          scoringType: "WHOLE",
          shotsPerSeries: 10,
        })
      )
    const html = render(bracket.semiFinals)
    const help = html.indexOf('data-help="playoffs"')
    expect(help).toBeGreaterThan(-1)
    expect(html.indexOf(">Turnierbaum<")).toBeLessThan(help)
    expect(html.indexOf(">Halbfinale<")).toBeGreaterThan(help)
    // vor dem Start gibt es keinen Baum und kein „?“
    expect(render([])).not.toContain('data-help="playoffs"')
    // die kompakte Vorschau zeigt keine Hilfe
    expect(
      renderToStaticMarkup(
        createElement(PlayoffBracket, {
          bracket,
          canManage: false,
          compact: true,
          scoringType: "WHOLE",
          shotsPerSeries: 10,
        })
      )
    ).not.toContain("data-help")
  })

  it("ein leeres Feld der Vorschau behält seinen Strich und nennt den Grund als Tooltip", () => {
    const html = renderToStaticMarkup(
      createElement(BracketSlot, { preview: { nameA: "Esche, Olga" } })
    )
    expect(html).toContain('title="steht noch nicht fest"')
    expect(html).toContain(">—</span>")
    expect(html.match(/title=/g)).toHaveLength(1)
  })
})
