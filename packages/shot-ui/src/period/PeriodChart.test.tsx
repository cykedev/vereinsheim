import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { formatDateOnly } from "@vereinsheim/lib/format"

import { DAY_MS } from "./calendar"
import { periodModel } from "./model"
import { monthStarts, PeriodChart } from "./PeriodChart"
import { initialPeriodState, type PeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"

const render = (
  cards: ReturnType<typeof periodCard>[],
  state: Partial<PeriodState> = {},
  chosen: string | null = null,
  colors?: { a: string; b: string }
) =>
  renderToStaticMarkup(
    createElement(PeriodChart, {
      width: 600,
      model: periodModel({
        items: cards.map(item),
        state: { ...initialPeriodState({ family: "lg-10m" }), ...state },
        nowMs: NOW,
        timeZone: TZ,
        named: [],
      }),
      timeZone: TZ,
      chosen,
      onChoose: () => {},
      colors,
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
/** x der Punkte einer Seite (`data-card-point` A, `data-compare-point` B), ohne den Ring eines Wettkampfs */
const pointXs = (html: string, attr: string) =>
  [
    ...html.matchAll(
      new RegExp(
        `<g ${attr}="[^"]*"[^>]*>(?:<circle[^>]*data-competition[^>]*></circle>)?<circle cx="(-?[\\d.]+)"`,
        "g"
      )
    ),
  ].map((m) => Number(m[1]))

describe("Verlauf je Scheibe", () => {
  const html = render(TWELVE, { includeWarmup: true })

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

describe("Verlauf je Monat und im Vergleich", () => {
  // 30 Scheiben im Juli, 31 im August und September: je Monat Median und Spanne
  const many = Array.from({ length: 61 }, (_, i) => periodCard(`m${i}`, 85 - i, [95 + (i % 5), 96]))

  it("ab 60 Scheiben je Monat: Punkt, Spanne P10–P90, Monat und Zahl darunter", () => {
    const html = render(many)
    expect(count(html, /data-month="/g)).toBe(3)
    expect(count(html, /data-month-span="true"/g)).toBe(3)
    expect(html).not.toContain("data-card-point")
    // die Tabelle in Alltagsworten: Mitte und Spanne, kein Median, P10, P90
    expect(html).toMatch(/<th scope="col"[^>]*>Mitte<\/th><th scope="col"[^>]*>Spanne von<\/th>/)
    expect(html).not.toMatch(/Median|P10|P90/)
  })

  it("mit Vergleich beide Zeiträume über die Zeit seit ihrem Beginn, mit Legende und zwei Zeilen Monate", () => {
    // A: 42 bis 27 Tage vor jetzt, also spät in den 90 Tagen; B: 100 bis 102 Tage vor jetzt, also spät im Zeitraum davor
    const now = TWELVE.slice(6)
    const before = [9, 10, 9].map((v, i) => periodCard(`v${i}`, 100 + i, [v * 10]))
    const html = render([...now, ...before], { compare: { type: "previous" } })
    expect(html).toMatch(/data-side-legend="true"[\s\S]*Letzte 90 Tage[\s\S]*Zeitraum davor/)
    expect(count(html, /data-compare-point="/g)).toBe(3)
    expect(count(html, /data-card-point="/g)).toBe(6)
    expect(html).not.toContain("data-band")
    expect(html).toContain('data-month-row="a"')
    expect(html).toContain('data-month-row="b"')
    // Gegenprobe zur Achse nach Nummer: Dort stünde die erste Scheibe von B über der ersten von A
    const xsA = pointXs(html, "data-card-point")
    const xsB = pointXs(html, "data-compare-point")
    expect([xsA.length, xsB.length]).toEqual([6, 3])
    expect(Math.min(...xsB)).toBeGreaterThan(Math.min(...xsA) + 50)
    // und B auf der Achse, ab dem Beginn des eigenen Zeitraums
    expect(Math.min(...xsB)).toBeGreaterThan(0)
  })

  it("Farben der Seiten wie im Bild: beide gefüllt, B ohne Ring; Ablesung nennt die Seite; Tabelle nach Datum", () => {
    const now = TWELVE.slice(6)
    const before = [9, 10, 9].map((v, i) => periodCard(`v${i}`, 100 + i, [v * 10]))
    const html = render([...now, ...before], { compare: { type: "previous" } }, "v1", {
      a: "var(--compare-a)",
      b: "var(--compare-b)",
    })
    expect(html).not.toContain("var(--primary)")
    // B gefüllt in seiner Farbe mit dunklem Saum, wie die Punkte im Bild
    expect(
      count(
        html,
        /data-compare-point="[^"]*"[^>]*><circle[^>]*fill="var\(--compare-b\)"[^>]*stroke="var\(--shot-edge\)"/g
      )
    ).toBe(3)
    // A gefüllt (nur Probe hohl), Wettkampf mit Ring
    expect(
      count(
        html,
        /data-card-point="[^"]*"[^>]*>(?:<circle[^>]*data-competition[^>]*><\/circle>)?<circle[^>]*fill="var\(--(?:compare-a|card)\)"/g
      )
    ).toBe(6)
    // die Legende wie unter dem Bild
    expect(html).toContain("background:var(--compare-a)")
    expect(html).toContain("background:var(--compare-b)")
    // die Ablesung der gewählten Scheibe von B nennt ihre Seite, ihr Datum und den Abstand zur einzigen Scheibe davor
    // (v2), ohne Paarung mit A
    expect(html).toContain(
      `Zeitraum davor · ${formatDateOnly(new Date(NOW - 101 * DAY_MS), TZ)} · `
    )
    expect(html).toMatch(/Zeitraum davor · [^<]*zum Schnitt der Scheibe davor/)
    expect(html).not.toContain("im Vergleich")
    expect(html).toMatch(/<th scope="col"[^>]*>Datum<\/th><th scope="col"[^>]*>Zeitraum<\/th>/)
    expect(html).toContain('data-ruler="true"')
  })
})

describe("Vergleich zweier ungleich langer Zeiträume", () => {
  // A: die letzten 30 Tage; B: 90 Tage vor einem Jahr, dreimal so lang. Die Achse ist so lang wie B
  const a = [25, 15, 5].map((days, i) => periodCard(`a${i}`, days, [95]))
  const b = [
    periodCard("b1", 360, [90], { kind: "competition" }),
    periodCard("b2", 330, [92], { probe: true }),
    periodCard("b3", 285, [94]),
  ]
  const compareTo = { fromMs: NOW - 365 * DAY_MS, toMs: NOW - 275 * DAY_MS, label: "Vorjahr" }
  const model = periodModel({
    items: [...a, ...b].map(item),
    state: { ...initialPeriodState({ family: "lg-10m" }), choice: { type: "rolling", days: 30 } },
    compareTo,
    nowMs: NOW,
    timeZone: TZ,
    named: [],
  })
  const html = renderToStaticMarkup(
    createElement(PeriodChart, {
      width: 600,
      model,
      timeZone: TZ,
      chosen: null,
      onChoose: () => {},
      colors: { a: "var(--compare-a)", b: "var(--compare-b)" },
    })
  )
  // wie `PAD` im Verlauf: 44 px links, 14 px rechts
  const left = 44
  const plot = 600 - 44 - 14
  const span = Math.max(model.range.toMs - model.range.fromMs, compareTo.toMs - compareTo.fromMs)
  const xOf = (id: string) =>
    Number(
      html.match(
        new RegExp(
          `<g data-[a-z-]+-point="${id}"[^>]*>(?:<circle[^>]*data-competition[^>]*></circle>)?<circle cx="(-?[\\d.]+)"`
        )
      )?.[1]
    )

  it("die Achse ist so lang wie der längere: A endet im ersten Drittel, B reicht fast bis rechts", () => {
    expect(Math.max(...a.map((c) => xOf(c.id)))).toBeLessThan(left + plot / 2)
    expect(Math.max(...b.map((c) => xOf(c.id)))).toBeGreaterThan(left + plot * 0.8)
    // die Punkte stehen in ihrer Folge auf der Achse (Lineal und Tastatur gehen über diese Folge)
    const order = [...html.matchAll(/<g data-[a-z-]+-point="([^"]*)"/g)].map((m) => xOf(m[1]))
    expect(order).toHaveLength(6)
    expect(order).toEqual([...order].sort((p, q) => p - q))
  })

  it("Linie und Monate von B ab dem Beginn von B", () => {
    const line = html.match(/<g data-mean-side="b"><path data-mean="[a-z]+" d="M(-?[\d.]+) /)
    expect(Number(line?.[1])).toBeCloseTo(xOf("b1"), 0)
    const [start] = monthStarts(compareTo.fromMs, compareTo.toMs, TZ)
    const tick = html.match(/<g data-month-row="b"><g><line x1="(-?[\d.]+)"/)
    expect(
      Math.abs(Number(tick?.[1]) - (left + ((start - compareTo.fromMs) / span) * plot))
    ).toBeLessThanOrEqual(1)
  })

  it("Wettkampf und nur Probe auch in B; die Tabelle nennt jede Scheibe von B", () => {
    expect(html).toMatch(/<g data-compare-point="b1"[^>]*><circle data-competition="true"/)
    expect(html).toMatch(
      /<g data-compare-point="b2"[^>]*><circle[^>]*fill="var\(--card\)"[^>]*stroke="var\(--compare-b\)"/
    )
    const table = html.slice(html.indexOf("<table"))
    expect(count(table, /<td[^>]*>Vorjahr<\/td>/g)).toBe(3)
    expect(count(table, /<td[^>]*>Letzte 30 Tage<\/td>/g)).toBe(3)
  })
})
