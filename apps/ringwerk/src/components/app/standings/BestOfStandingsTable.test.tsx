import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BestOfStandingsTable } from "./BestOfStandingsTable"
import type { BestOfStandingRow } from "@/lib/standings/queries"

// Markup-Test ohne jsdom: die Podiumsregel hängt allein an class-Attributen.

function row(lastName: string, rank: number, played: number): BestOfStandingRow {
  return {
    participantId: lastName,
    firstName: "F",
    lastName,
    withdrawn: false,
    played,
    wins: played,
    losses: 0,
    duelsWon: played * 2,
    duelsLost: 0,
    duelDiff: played * 2,
    bestRingteiler: null,
    bestRings: null,
    directComparison: null,
    rank,
  }
}

const render = (rows: BestOfStandingRow[]) =>
  renderToStaticMarkup(createElement(BestOfStandingsTable, { rows }))

describe("BestOfStandingsTable — Podiumsfarben", () => {
  it("ohne gespielte Begegnung: Platz 1 für alle, aber neutral und ohne Zeilen-Highlight", () => {
    const html = render([row("Alpha", 1, 0), row("Beta", 1, 0)])
    expect(html).not.toContain("bg-rank-1")
    expect(html).toContain("bg-muted text-muted-foreground")
  })

  it("mit gespielter Begegnung: Gold-Badge und Gold-Zeile", () => {
    const html = render([row("Alpha", 1, 1)])
    expect(html).toContain("bg-rank-1/20")
    expect(html).toContain("bg-rank-1/10")
  })
})
