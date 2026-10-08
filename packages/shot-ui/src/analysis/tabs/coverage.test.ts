import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"
import { describe, expect, it } from "vitest"

import { ANALYSIS_TABS } from "../AnalysisPanel"
import { renderTab } from "../testPanel"

// D4: Jedes Thema der Hilfe und die Oberflächen-Hilfen der Analyse haben ihren Platz, jedes genau einmal.
describe("Hilfe in der Analyse", () => {
  const pages = ANALYSIS_TABS.map((tab) => renderTab(tab.value))
  const cards = pages.flatMap((html) => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]))
  const helps = new Set(
    pages.flatMap((html) => [...html.matchAll(/data-help="([^"]+)"/g)].map((m) => m[1]))
  )

  it("jedes Thema als Karte oder als Hilfe der Datenlage, keine Karte doppelt", () => {
    for (const topic of HELP_TOPICS) expect(helps, topic.id).toContain(topic.id)
    expect(new Set(cards).size).toBe(cards.length)
    expect(HELP_TOPICS.filter((t) => !cards.includes(t.id)).map((t) => t.id)).toEqual(["datenlage"])
  })

  it("die Oberflächen-Hilfen Beobachtungen und Probe auf der Scheibe", () => {
    for (const id of ["beobachtungen", "probe-auf-der-scheibe"]) {
      expect(VIEW_HELP.map((v) => v.id)).toContain(id)
      expect(cards).toContain(id)
    }
  })
})
