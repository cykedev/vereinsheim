import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { extractPdfText } from "./pdfTestUtils"
import { SeasonStandingsPdf, type SeasonStandingsPdfProps } from "@/lib/pdf/SeasonStandingsPdf"
import type { SortedSeasonStandingsEntry } from "@/lib/scoring/sortSeasonStandings"

function entry(
  name: string,
  seriesCount: number,
  requiredSeries: number,
  rings: number
): SortedSeasonStandingsEntry {
  return {
    participantId: name,
    participantName: name,
    seriesCount,
    requiredSeries,
    meetsMinSeries: seriesCount >= requiredSeries,
    bestRings: rings,
    bestRingsScoringType: "WHOLE",
    bestRings_rank: null,
    bestCorrectedTeiler: 5,
    bestTeiler_rank: null,
    bestRingteiler: 100 - rings + 5,
    bestRingteiler_rank: null,
    alternatingBy: null,
  }
}

describe("SeasonStandingsPdf — Spalte „Serien“", () => {
  const props: SeasonStandingsPdfProps = {
    displayTimeZone: "Europe/Berlin",
    competitionName: "Jahrespreisschiessen 2026",
    disciplineName: "Luftgewehr",
    seasonStart: null,
    seasonEnd: null,
    scoringMode: "RINGS",
    shotsPerSeries: 10,
    minSeries: 20,
    isMixed: false,
    entries: [entry("Ausnahme, Anna", 3, 1, 98), entry("Wenig, Willi", 2, 20, 99)],
    sort: "rings",
    generatedAt: new Date("2026-10-20T10:00:00.000Z"),
  }

  it("zeigt je Zeile die eigene Mindestzahl: 3/1 mit Ausnahme, 2/20 ohne", async () => {
    const buffer = await renderToBuffer(
      createElement(SeasonStandingsPdf, props) as ReactElement<DocumentProps>
    )
    const text = extractPdfText(buffer)
    expect(text).toContain("3/1")
    expect(text).toContain("2/20")
    expect(text).not.toContain("3/20")
  })
})
