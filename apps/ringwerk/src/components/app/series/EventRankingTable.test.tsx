import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { EventRankedEntry } from "@/lib/scoring/rankEventParticipants"

import { EventRankingTable } from "./EventRankingTable"

const entry = {
  seriesId: "s1",
  participantName: "Esche, Olga",
  isGuest: false,
  teamNumber: null,
  disciplineName: "Luftgewehr",
  disciplineScoringType: "WHOLE",
  rings: 96,
  teiler: 35,
  correctedTeiler: 35,
  score: 39,
  rank: 1,
} as unknown as EventRankedEntry

const render = (props: Partial<Parameters<typeof EventRankingTable>[0]>) =>
  renderToStaticMarkup(
    createElement(EventRankingTable, { entries: [entry], scoringMode: "RINGTEILER", ...props })
  )

describe("EventRankingTable — Hilfe", () => {
  it("erklärt Teiler und Ringteiler an ihren Spaltenköpfen", () => {
    const html = render({})
    expect(html).toContain('data-help="teiler"')
    expect(html).toContain('data-help="ringteiler"')
  })

  it("gemischt: das „?“ am Teiler erklärt die Korrektur", () => {
    const html = render({ isMixed: true })
    expect(html).toContain('data-help="corrected-teiler"')
    expect(html).not.toContain('data-help="teiler"')
  })

  it("ohne Wertung nach Ringteiler kein „?“ an der Wertungsspalte", () => {
    expect(render({ scoringMode: "RINGS" })).not.toContain('data-help="ringteiler"')
  })

  it("in der Vorschau ohne „?“", () => {
    expect(render({ help: false })).not.toContain("data-help")
  })
})
