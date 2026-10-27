import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { periodModel } from "./model"
import { PeriodResult } from "./PeriodResult"
import { initialPeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"

const model = (items: ReturnType<typeof item>[]) =>
  periodModel({
    items,
    state: initialPeriodState({ family: "lg-10m" }),
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })
const measured = [1, 2, 3].map((d) => item(periodCard(`m${d}`, d, [100, 101, 99])))
const waiting = { ...item(periodCard("w", 4, [])), provenance: "printout" as const }

describe("Ergebnis-Box: Grundlage", () => {
  it("zählen alle, keine Zeile", () => {
    expect(
      renderToStaticMarkup(h(PeriodResult, { model: model(measured), timeZone: TZ }))
    ).not.toContain("data-period-basis")
  })

  it("zählt eine nicht, die Grundlage mit Grund; das „?“ nur mit `onHelp`", () => {
    const m = model([...measured, waiting])
    const html = renderToStaticMarkup(h(PeriodResult, { model: m, timeZone: TZ }))
    expect(html).toMatch(
      /data-period-basis="true"[^>]*>über 3 von 4 Scheiben · 1 wartet auf die Anlage/
    )
    expect(html).not.toContain('data-help="grundlage"')
    expect(
      renderToStaticMarkup(h(PeriodResult, { model: m, timeZone: TZ, onHelp: () => {} }))
    ).toContain('data-help="grundlage"')
  })
})
