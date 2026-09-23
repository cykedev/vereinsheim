import { describe, it, expect } from "vitest"
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { PlayoffBracketData } from "@/lib/playoffs/types"
import type { StandingRow } from "@/lib/standings/queries"
import type { EventRankedEntry, EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import type { SortedSeasonStandingsEntry } from "@/lib/scoring/sortSeasonStandings"
import {
  PREVIEW_ROWS,
  previewEmptyText,
  previewIsEmpty,
  previewMoreCount,
  type CompetitionPreview,
} from "./previewModel"

// Nur die Längen zählen — die Zeilen selbst sind für das Modell undurchsichtig.
const rows = <T>(n: number) => Array.from({ length: n }, () => ({}) as T)
const competition = {} as CompetitionListItem
const bracket = {} as PlayoffBracketData

function league(opts: { playoffsStarted: boolean; standings: number }): CompetitionPreview {
  return {
    kind: "league",
    competition,
    href: "/competitions/x/schedule",
    isBestOf: false,
    playoffsStarted: opts.playoffsStarted,
    standings: rows<StandingRow>(opts.standings),
    bestOfStandings: [],
    bracket,
  }
}

describe("previewModel", () => {
  it("Liga nach Playoff-Start: kein „weitere“-Hinweis und nie leer (das Bracket steht)", () => {
    const p = league({ playoffsStarted: true, standings: 0 })
    expect(previewMoreCount(p)).toBeUndefined()
    expect(previewIsEmpty(p)).toBe(false)
  })

  it("Liga ohne Playoffs: zählt die Zeilen über die Vorschau hinaus", () => {
    const p = league({ playoffsStarted: false, standings: PREVIEW_ROWS + 2 })
    expect(previewMoreCount(p)).toBe(2)
    expect(previewIsEmpty(p)).toBe(false)
    expect(previewEmptyText(p)).toBe("Noch keine Ergebnisse erfasst")
  })

  it("Team-Event zählt die Teams, nicht die Einzelwertung", () => {
    const p: CompetitionPreview = {
      kind: "event",
      competition,
      href: "/competitions/x/ranking",
      isTeamEvent: true,
      ranked: rows<EventRankedEntry>(20),
      teamRanked: rows<EventTeamRankedEntry>(3),
    }
    expect(previewMoreCount(p)).toBe(0)
  })

  it("Saison ohne Teilnehmer ist leer, mit Serien-Hinweis", () => {
    const p: CompetitionPreview = {
      kind: "season",
      competition,
      href: "/competitions/x/standings",
      standings: rows<SortedSeasonStandingsEntry>(0),
      minSeries: null,
      sort: "ringteiler",
    }
    expect(previewIsEmpty(p)).toBe(true)
    expect(previewEmptyText(p)).toBe("Noch keine Serien erfasst")
  })
})
