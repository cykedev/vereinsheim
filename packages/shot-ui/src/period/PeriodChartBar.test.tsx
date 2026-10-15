import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PeriodChartBar, type PeriodChartBarProps } from "./PeriodChartBar"

const html = (props: Partial<PeriodChartBarProps> = {}) =>
  renderToStaticMarkup(
    h(PeriodChartBar, {
      metric: "result.decimalMean",
      view: "cards",
      onMetric: () => {},
      onView: () => {},
      onHelp: () => {},
      ...props,
    })
  )

describe("Bedienung über dem Verlauf", () => {
  it("passt alles, eine Zeile; sonst Kennzahl oben, darunter Darstellung links und „?“ rechts, an der Karte gemessen", () => {
    const bar = html()
    expect(bar).toMatch(/^<div class="@container min-w-0"><div data-chart-bar/)
    expect(bar).toMatch(
      /data-chart-bar="true" class="[^"]*flex-col items-start @min-\[35rem\]:flex-row @min-\[35rem\]:items-center/
    )
    // kein Umbruch, bei dem die Darstellung allein rechts landet
    expect(bar).not.toContain("flex-wrap")
    expect(bar).not.toContain("justify-between")
    // Kennzahl, dann Darstellung und „?“ in einer Gruppe; die Gruppe so breit wie die Karte, bis alles in eine Zeile passt
    expect(bar).toMatch(
      /aria-label="Kennzahl"[\s\S]*<div class="flex w-full items-center gap-2 @min-\[35rem\]:ml-auto @min-\[35rem\]:w-auto"><div role="radiogroup" aria-label="Darstellung des Verlaufs"[\s\S]*data-help="verlauf-und-form"/
    )
    expect(bar).toMatch(/<button[^>]*data-help="verlauf-und-form"[^>]*class="[^"]*\bml-auto\b/)
  })

  it("die Kennzahl bricht nicht um, sie scrollt in sich", () => {
    expect(html()).toMatch(/aria-label="Kennzahl" class="[^"]*\boverflow-x-auto\b/)
  })

  it("mit Vergleich ohne Darstellung: Kennzahl und „?“ in einer Zeile", () => {
    const bar = html({ view: null })
    expect(bar).not.toContain("Darstellung des Verlaufs")
    expect(bar).toMatch(/data-chart-bar="true" class="flex min-w-0 gap-2 items-center"/)
    expect(bar).toContain('data-help="verlauf-und-form"')
  })
})
