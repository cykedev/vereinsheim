import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { periodModel } from "./model"
import { PeriodChart } from "./PeriodChart"
import { initialPeriodState, type PeriodState } from "./state"
import { NOW, periodCard, projected, TZ } from "./testSeason"

const render = (
  cards: ReturnType<typeof periodCard>[],
  state: Partial<PeriodState> = {},
  chosen: string | null = null
) =>
  renderToStaticMarkup(
    createElement(PeriodChart, {
      width: 600,
      model: periodModel({
        cards: cards.map(projected),
        state: { ...initialPeriodState({ family: "lg-10m" }), ...state },
        nowMs: NOW,
        timeZone: TZ,
        named: [],
      }),
      timeZone: TZ,
      chosen,
      onChoose: () => {},
    })
  )

// zwölf Scheiben im Zeitraum, die vierte ein Wettkampf, die sechste nur Probe
const TWELVE = [9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10].map((v, i) =>
  periodCard(`k${i}`, 60 - 3 * i, [v * 10, v * 10], {
    kind: i === 3 ? "competition" : "training",
    probe: i === 5,
  })
)
const count = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].length

describe("Verlauf je Scheibe (D7)", () => {
  const html = render(TWELVE, { includeProbeOnly: true })

  it("ein Punkt je Scheibe, Wettkampf mit Ring, nur Probe hohl", () => {
    expect(count(html, /data-card-point="/g)).toBe(12)
    expect(count(html, /data-competition="true"/g)).toBe(1)
    expect(html).toMatch(/data-card-point="k5"><circle[^>]*fill="var\(--card\)"/)
  })

  it("Schnitt bisher gestrichelt, dann durchgezogen; das Band als Fläche ab zehn Scheiben", () => {
    expect(html).toMatch(/data-mean="partial"[^>]*stroke-dasharray="4 4"/)
    expect(html).toMatch(/data-mean="full"/)
    expect(html).toMatch(/data-band="true"[^>]*fill="var\(--primary\)" fill-opacity="0.12"/)
    expect(render(TWELVE.slice(0, 9))).not.toContain("data-band")
  })

  it("Werte als Tabelle mit allen Scheiben, das Lineal als Schieberegler", () => {
    expect(count(html, /<tr class="border-t/g)).toBe(12)
    expect(html).toMatch(/role="slider"[^>]*aria-valuemax="12"/)
  })

  it("eine gewählte Scheibe steht im Lineal, mit dem Abstand zum Schnitt der Scheiben davor", () => {
    const html = render(TWELVE, {}, "k2")
    expect(html).toMatch(/data-card-point="k2" data-chosen="true"/)
    // k2 (8,0) gegen k0 und k1 (9,0 und 10,0): −1,50, wie in Liste und Ablesung
    expect(html).toContain("8,00 Ringe · −1,50 zum Schnitt der 2 Scheiben davor")
    expect(render(TWELVE, {}, "k0")).toContain(
      "10,00 Ringe · erste Scheibe".replace("10,00", "9,00")
    )
  })

  it("unter zwei Scheiben ein Satz statt des Diagramms", () => {
    const one = render(TWELVE.slice(0, 1))
    expect(one).toContain("Für einen Verlauf braucht es zwei Scheiben mit Wert.")
    expect(one).not.toContain("<svg")
  })
})

describe("Verlauf je Monat und im Vergleich (D7)", () => {
  // 30 Scheiben im Juli, 31 im August und September: je Monat Median und Spanne
  const many = Array.from({ length: 61 }, (_, i) => periodCard(`m${i}`, 85 - i, [95 + (i % 5), 96]))

  it("ab 60 Scheiben je Monat: Punkt, Spanne P10–P90, Monat und Zahl darunter", () => {
    const html = render(many)
    expect(count(html, /data-month="/g)).toBe(3)
    expect(count(html, /data-month-span="true"/g)).toBe(3)
    expect(html).not.toContain("data-card-point")
    // die Tabelle in Alltagsworten (Review U3): Mitte und Spanne, kein Median, P10, P90
    expect(html).toMatch(/<th scope="col"[^>]*>Mitte<\/th><th scope="col"[^>]*>Spanne von<\/th>/)
    expect(html).not.toMatch(/Median|P10|P90/)
  })

  it("mit Vergleich beide Zeiträume übereinander, mit Legende, ohne Band", () => {
    const now = TWELVE.slice(6)
    const before = [9, 10, 9].map((v, i) => periodCard(`v${i}`, 100 + i, [v * 10]))
    const html = render([...now, ...before], { compare: { type: "previous" } })
    expect(html).toMatch(/data-legend="true"[\s\S]*Letzte 90 Tage[\s\S]*Zeitraum davor/)
    expect(count(html, /data-compare-point="true"/g)).toBe(3)
    expect(count(html, /data-card-point="/g)).toBe(6)
    expect(html).not.toContain("data-band")
  })
})
