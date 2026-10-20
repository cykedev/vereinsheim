import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { StandingsTable } from "./StandingsTable"
import type { StandingRow } from "@/lib/standings/queries"

// Markup-Test ohne jsdom: die Podiumsregel hängt allein an class-Attributen.

function row(lastName: string, rank: number, played: number, byes = 0): StandingRow {
  return {
    participantId: lastName,
    firstName: "F",
    lastName,
    withdrawn: false,
    played,
    wins: played,
    draws: 0,
    losses: 0,
    byes,
    points: (played + byes) * 2,
    bestRingteiler: played > 0 ? 10 : null,
    bestRings: played > 0 ? 95 : null,
    rank,
  }
}

const render = (rows: StandingRow[]) =>
  renderToStaticMarkup(createElement(StandingsTable, { rows }))

describe("StandingsTable — Podiumsfarben", () => {
  it("ohne Ergebnis: Platz 1 für alle, aber neutral und ohne Zeilen-Highlight", () => {
    const html = render([row("Alpha", 1, 0), row("Beta", 1, 0)])
    expect(html).not.toContain("bg-rank-1")
    expect(html).toContain("bg-muted text-muted-foreground")
  })

  it("mit Ergebnis (auch nur Freilos): Gold-Badge und Gold-Zeile", () => {
    const html = render([row("Alpha", 1, 0, 1)])
    expect(html).toContain("bg-rank-1/20")
    expect(html).toContain("bg-rank-1/10")
  })
})

describe("StandingsTable — Hilfe und „–“ mit Grund", () => {
  it("erklärt „Best. RT“ und nennt ohne Duell den Grund", () => {
    const html = render([row("Alpha", 1, 1), row("Beta", 2, 0)])
    expect(html).toContain('data-help="ringteiler"')
    expect(html.match(/data-missing="noDuel"/g)).toHaveLength(1)
    expect(html).toContain(">noch kein Duell<")
  })

  it("ein Zurückgezogener hat keinen Platz, der Grund steht als Tooltip", () => {
    const html = render([{ ...row("Alpha", 1, 1), withdrawn: true }])
    expect(html).toContain('title="ohne Platz"')
    expect(html).not.toContain("—")
  })

  it("ein Zurückgezogener ohne gewertetes Duell zeigt beim Ringteiler nur „–“", () => {
    const html = render([{ ...row("Alpha", 1, 0), withdrawn: true }])
    expect(html).not.toContain('data-missing="noDuel"')
  })

  it("in der Vorschau ohne „?“", () => {
    const html = renderToStaticMarkup(
      createElement(StandingsTable, { rows: [row("Alpha", 1, 1)], help: false })
    )
    expect(html).not.toContain("data-help")
  })
})
