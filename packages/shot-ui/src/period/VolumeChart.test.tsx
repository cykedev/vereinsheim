import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { VolumeChart, weekText, type VolumeWeek } from "./VolumeChart"

const WEEKS: VolumeWeek[] = [
  { key: "2026-W28", label: "06.07.", shots: 140, cards: 3, days: 2 },
  { key: "2026-W29", label: "13.07.", shots: 0, cards: 0, days: 0 },
  { key: "2026-W30", label: "20.07.", shots: 40, cards: 1, days: 1 },
]
const html = renderToStaticMarkup(createElement(VolumeChart, { width: 400, weeks: WEEKS }))

describe("Umfang je Woche (D15)", () => {
  it("eine Säule je Woche mit Schüssen, eine leere Woche ohne Säule", () => {
    expect([...html.matchAll(/data-week="/g)].map((m) => m.index)).toHaveLength(2)
    expect(html).not.toContain('data-week="2026-W29"')
  })

  it("die höchste Säule reicht bis an ihren Wert", () => {
    // Teilung 100 für höchstens 140: Achse bis 200, 140 Schuss auf 70 % der Höhe
    const bar = html.match(/data-week="2026-W28"[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/)!
    expect(Number(bar[2]) / (120 - 22 - 10)).toBeCloseTo(0.7, 2)
  })

  it("das Lineal nennt Schüsse mit Probe, Scheiben und Tage; Tabelle mit allen Wochen", () => {
    // Woche als Datum ihres Montags (U3, D6), keine Kalenderwoche
    expect(weekText(WEEKS[0])).toBe("Woche ab 06.07.2026: 140 Schuss mit Probe, 3 Scheiben, 2 Tage")
    expect(weekText(WEEKS[2])).toBe("Woche ab 20.07.2026: 40 Schuss mit Probe, 1 Scheibe, 1 Tag")
    expect(weekText(WEEKS[1])).toBe("Woche ab 13.07.2026: kein Training")
    expect(html).toContain(">06.07.2026</th>")
    expect([...html.matchAll(/<tr class="border-t/g)]).toHaveLength(3)
    expect(html).toContain(">Woche ab</th>")
    expect(html).not.toContain("KW")
  })
})
