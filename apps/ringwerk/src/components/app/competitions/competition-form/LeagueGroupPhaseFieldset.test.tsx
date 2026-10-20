import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LeagueGroupPhaseFieldset } from "./LeagueGroupPhaseFieldset"
import type { CompetitionFormState } from "./useCompetitionFormState"

const noop = () => {}

describe("LeagueGroupPhaseFieldset", () => {
  it("bietet im Best-of keine Wahl zum Gleichstand an: er geht immer in den Stechschuss", () => {
    const form = {
      isPending: false,
      isBestOfSingle: true,
      leagueFormat: "BEST_OF_SINGLE",
      onLeagueFormatChange: noop,
      groupBestOf: "3",
      setGroupBestOf: noop,
      groupPlayAllDuels: true,
      setGroupPlayAllDuels: noop,
      groupTiebreaker1: "none",
      setGroupTiebreaker1: noop,
      groupTiebreaker2: "none",
      setGroupTiebreaker2: noop,
      shotsPerSeries: "10",
      setShotsPerSeries: noop,
    } as unknown as CompetitionFormState
    const html = renderToStaticMarkup(
      createElement(LeagueGroupPhaseFieldset, { form, hasMatchups: false })
    )
    expect(html).toContain("groupTiebreaker1")
    expect(html).not.toContain("groupHasSuddenDeath")
    expect(html).not.toContain("Gleichstand per Stechschuss")
  })
})
