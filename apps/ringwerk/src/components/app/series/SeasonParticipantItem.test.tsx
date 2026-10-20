import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Die Dialoge daneben laden Server-Actions; für die Zeile tragen sie nichts bei.
vi.mock("./SeasonSeriesDialog", () => ({ SeasonSeriesDialog: () => null }))
vi.mock("./DeleteSeasonSeriesButton", () => ({ DeleteSeasonSeriesButton: () => null }))

import { SeasonParticipantItem } from "./SeasonParticipantItem"

const series = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    rings: 95,
    teiler: 5,
    ringteiler: 10,
    sessionDate: "12.10.2026",
    sessionDateIso: "2026-10-12",
  }))

function render(exemptFromMinSeries: boolean, minSeries: number | null = 20): string {
  return renderToStaticMarkup(
    createElement(SeasonParticipantItem, {
      competitionId: "c1",
      participantId: "p1",
      firstName: "Anna",
      lastName: "Birke",
      series: series(3),
      minSeries,
      exemptFromMinSeries,
      isMixed: false,
      scoringMode: "RINGS",
      shotsPerSeries: 10,
    })
  )
}

describe("SeasonParticipantItem — Mindestzahl der Zeile", () => {
  it("ohne Ausnahme die Mindestzahl der Saison", () => {
    expect(render(false)).toContain("3 Serien / 20 Mindest")
  })

  it("mit Ausnahme 1", () => {
    expect(render(true)).toContain("3 Serien / 1 Mindest")
  })

  it("ohne Mindestzahl in der Saison nichts dahinter", () => {
    const html = render(true, null)
    expect(html).toContain("3 Serien")
    expect(html).not.toContain("Mindest")
  })
})
