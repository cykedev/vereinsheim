import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LeagueGroupPhaseFieldset } from "./LeagueGroupPhaseFieldset"
import type { CompetitionFormState } from "./useCompetitionFormState"

const noop = () => {}

function formState(isBestOfSingle: boolean): CompetitionFormState {
  return {
    isPending: false,
    isBestOfSingle,
    leagueFormat: isBestOfSingle ? "BEST_OF_SINGLE" : "DOUBLE_ROUND_ROBIN",
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
}

const render = (props: { hasSchedule: boolean; rulesetLocked: boolean }) =>
  renderToStaticMarkup(
    createElement(LeagueGroupPhaseFieldset, { form: formState(false), ...props })
  )

const LOCKED = "Regelset gesperrt: Es sind schon Ergebnisse eingetragen."
const REPLACES = "Es gibt schon einen Spielplan. Ein anderes Format erzeugt ihn beim Speichern neu."

describe("LeagueGroupPhaseFieldset", () => {
  it("bietet im Best-of keine Wahl zum Gleichstand an: er geht immer in den Stechschuss", () => {
    const html = renderToStaticMarkup(
      createElement(LeagueGroupPhaseFieldset, {
        form: formState(true),
        hasSchedule: false,
        rulesetLocked: false,
      })
    )
    expect(html).toContain("groupTiebreaker1")
    expect(html).not.toContain("groupHasSuddenDeath")
    expect(html).not.toContain("Gleichstand per Stechschuss")
  })

  it("ohne Spielplan: bearbeitbar, ohne Hinweis", () => {
    const html = render({ hasSchedule: false, rulesetLocked: false })
    expect(html).not.toMatch(/<fieldset[^>]*disabled/)
    expect(html).not.toContain(LOCKED)
    expect(html).not.toContain(REPLACES)
  })

  it("mit Spielplan ohne Ergebnis: bearbeitbar, mit Hinweis auf den neuen Spielplan", () => {
    const html = render({ hasSchedule: true, rulesetLocked: false })
    expect(html).not.toMatch(/<fieldset[^>]*disabled/)
    expect(html).toContain(REPLACES)
    expect(html).not.toContain(LOCKED)
  })

  it("mit Ergebnis: gesperrt, mit Schloss und Grund", () => {
    const html = render({ hasSchedule: true, rulesetLocked: true })
    expect(html).toMatch(/<fieldset[^>]*disabled/)
    expect(html).toContain(LOCKED)
    expect(html).not.toContain(REPLACES)
  })
})
