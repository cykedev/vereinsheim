import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LeaguePlayoffsFieldset } from "./LeaguePlayoffsFieldset"
import type { CompetitionFormState } from "./useCompetitionFormState"

const noop = () => {}

describe("LeaguePlayoffsFieldset", () => {
  it("bietet keine Wahl zur Verlängerung im Finale an: es gibt sie immer", () => {
    const form = {
      isPending: false,
      playoffBestOf: "5",
      setPlayoffBestOf: noop,
      playoffHasViertelfinale: true,
      setPlayoffHasViertelfinale: noop,
      playoffHasAchtelfinale: false,
      setPlayoffHasAchtelfinale: noop,
      finalePrimary: "RINGS",
      setFinalePrimary: noop,
      finaleTiebreaker1: "none",
      setFinaleTiebreaker1: noop,
      finaleTiebreaker2: "none",
      setFinaleTiebreaker2: noop,
    } as unknown as CompetitionFormState
    const html = renderToStaticMarkup(
      createElement(LeaguePlayoffsFieldset, { form, playoffsStarted: false })
    )
    expect(html).toContain("finalePrimary")
    expect(html).not.toContain("finaleHasSuddenDeath")
    expect(html).not.toContain("Stechschuss")
  })
})
