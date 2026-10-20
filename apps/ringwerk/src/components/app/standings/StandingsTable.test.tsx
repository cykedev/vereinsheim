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

const render = (rows: StandingRow[], scoringMode: "RINGTEILER" | "RINGS" = "RINGTEILER") =>
  renderToStaticMarkup(createElement(StandingsTable, { rows, scoringMode, scoringType: "WHOLE" }))

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
      createElement(StandingsTable, {
        rows: [row("Alpha", 1, 1)],
        scoringMode: "RINGTEILER",
        scoringType: "WHOLE",
        help: false,
      })
    )
    expect(html).not.toContain("data-help")
  })
})

describe("StandingsTable — Spalte bei Gleichstand", () => {
  it("Wertung nach Ringen: „Best. Ringe“ mit den meisten Ringen, ohne „?“", () => {
    const html = render([row("Alpha", 1, 1)], "RINGS")
    expect(html).toContain("Best. Ringe")
    expect(html).not.toContain("Best. RT")
    expect(html).toContain(">95<")
    expect(html).not.toContain('data-help="ringteiler"')
  })

  it("Wertung nach Ringteiler: „Best. RT“ mit dem besten Ringteiler", () => {
    const html = render([row("Alpha", 1, 1)])
    expect(html).toContain("Best. RT")
    expect(html).toContain(">10,0<")
  })
})

describe("StandingsTable — Kürzel im Kopf", () => {
  it("jedes Kürzel nennt seinen vollen Namen (Tooltip und Screenreader)", () => {
    const html = render([row("Alpha", 1, 2)])
    for (const [short, full] of [
      ["Pl.", "Platz"],
      ["Sp.", "Spiele"],
      ["S", "Siege"],
      ["U", "Unentschieden"],
      ["N", "Niederlagen"],
      ["Pkt.", "Punkte"],
    ])
      expect(html).toContain(`<abbr title="${full}" class="no-underline">${short}</abbr>`)
  })
})
