import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"
import { describe, expect, it } from "vitest"

import { ANALYSIS_TABS } from "../AnalysisPanel"
import { renderTab } from "../testPanel"

// Plan Schritt 4, D3: Jedes Thema der Hilfe hat genau ein „?“ (Knopf mit data-help) über alle Reiter, die
// Datenlage eins in jedem Reiter, dazu die Oberflächen-Hilfen der Analyse; keine Karte doppelt.
describe("Hilfe in der Analyse", () => {
  const pages = ANALYSIS_TABS.map((tab) => renderTab(tab.value))
  const cards = pages.flatMap((html) => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]))
  const buttons = pages.flatMap((html) =>
    [...html.matchAll(/<button[^>]*data-help="([^"]+)"/g)].map((m) => m[1])
  )
  const count = (id: string) => buttons.filter((b) => b === id).length

  it("jedes Thema einer Scheibe genau ein „?“, die Datenlage in jedem Reiter", () => {
    // die Themen über viele Scheiben gehören auf die Seite eines Zeitraums (L3)
    for (const topic of HELP_TOPICS.filter((t) => t.id !== "datenlage" && t.theme !== "period")) {
      expect(count(topic.id), topic.id).toBe(1)
    }
    expect(count("datenlage")).toBe(ANALYSIS_TABS.length)
  })

  it("die Oberflächen-Hilfen Beobachtungen und Probe auf der Scheibe mit ihrem „?“", () => {
    for (const id of ["beobachtungen", "probe-auf-der-scheibe"]) {
      expect(VIEW_HELP.map((v) => v.id)).toContain(id)
      expect(count(id), id).toBe(1)
    }
  })

  it("keine Karte doppelt, kein „Was heißt das?“ mehr in der Analyse", () => {
    expect(new Set(cards).size).toBe(cards.length)
    for (const html of pages) expect(html).not.toContain("<details data-help")
  })
})
