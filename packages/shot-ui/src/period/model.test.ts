import { describe, expect, it } from "vitest"

import type { NamedPeriod } from "./calendar"
import { periodModel, PERIOD_TILE_KEYS } from "./model"
import { periodSentence, verdictText } from "./sentence"
import { initialPeriodState, type PeriodState } from "./state"
import { NOW, periodCard, TZ } from "./testSeason"

const NAMED: NamedPeriod[] = [
  { id: "lm", name: "Vorbereitung", from: "2026-05-01", to: "2026-06-30" },
]
const model = (
  cards: Parameters<typeof periodCard>[] | ReturnType<typeof periodCard>[],
  state: Partial<PeriodState> = {}
) =>
  periodModel({
    cards: cards as ReturnType<typeof periodCard>[],
    state: { ...initialPeriodState({ family: "lg-10m" }), ...state },
    nowMs: NOW,
    timeZone: TZ,
    named: NAMED,
  })

/** drei Scheiben im Zeitraum, eine davor, ein Wettkampf */
const THREE = [
  periodCard("a", 3, [100, 100]),
  periodCard("b", 2, [90, 92]),
  periodCard("c", 1, [95]),
  periodCard("alt", 200, [109, 109]),
]

describe("Modell der Seite: Zeitraum, Werte, Ergebnis", () => {
  it("nur die Scheiben im Zeitraum, in ihrer Folge", () => {
    const m = model(THREE)
    expect(m.range.label).toBe("Letzte 90 Tage")
    expect(m.cards.map((c) => c.id)).toEqual(["a", "b", "c"])
    expect(m.values.map((v) => v.value)).toEqual([10, 9.1, 9.5])
  })

  it("Ergebnis: Mittel der Scheiben, nicht der Schüsse; beste Scheibe", () => {
    // je Scheibe 10,0 / 9,1 / 9,5 → 9,5333; über alle fünf Schüsse wären es 9,54
    const { summary } = model(THREE)
    expect(summary.mean).toBeCloseTo(28.6 / 3, 12)
    expect(summary.cards).toBe(3)
    expect(summary.shots).toBe(5)
    expect(summary.best?.id).toBe("a")
  })

  it("die erste Kachel ist Ø je Schuss mit demselben Mittel", () => {
    const { tiles } = model(THREE)
    expect(tiles.map((t) => t.key)).toEqual([...PERIOD_TILE_KEYS])
    expect(tiles[0].value).toBeCloseTo(28.6 / 3, 12)
    expect(tiles[0].n).toBe(3)
    expect(tiles[0].compare).toBeNull()
  })

  it("Art: nur Training oder nur Wettkampf", () => {
    const cards = [...THREE, periodCard("w", 4, [104], { kind: "competition" })]
    expect(model(cards, { kind: "competition" }).cards.map((c) => c.id)).toEqual(["w"])
    expect(model(cards, { kind: "training" }).cards.map((c) => c.id)).toEqual(["a", "b", "c"])
  })

  it("in ganzen Ringen die ganzen Ringe", () => {
    expect(model(THREE, { scoring: "rings" }).values.map((v) => v.value)).toEqual([10, 9, 9])
  })

  it("Rekorde über alle Scheiben der Familie, auch vor dem Zeitraum", () => {
    expect(model(THREE).records.bestCard[2].cardId).toBe("alt")
  })
})

describe("Vergleich und Satz", () => {
  // fünf Scheiben mit 6,0 … 10,0 im Zeitraum, fünf mit 1,0 … 5,0 im Zeitraum davor
  const now = [60, 70, 80, 90, 100].map((t, i) => periodCard(`n${i}`, 10 + i, [t]))
  const before = [10, 20, 30, 40, 50].map((t, i) => periodCard(`v${i}`, 100 + i, [t]))

  it("mit Urteil: höher, nachweisbar", () => {
    const m = model([...now, ...before], { compare: { type: "previous" } })
    expect(m.compareRange?.label).toBe("Zeitraum davor")
    expect(m.comparison?.verdict).toBe("higher")
    expect(m.comparison?.delta).toBeCloseTo(5, 12)
    expect(m.tiles[0].compare?.comparison?.verdict).toBe("higher")
    expect(periodSentence(m)).toBe(
      "Dein Ø je Schuss liegt 5,00 höher als im Zeitraum davor, nachweisbar."
    )
  })

  it("ohne Urteil: nicht nachweisbar; gleichauf; unter fünf je Seite: zu wenige", () => {
    // 6,0 … 10,0 gegen 6,5 … 10,5: 0,50 tiefer, ohne Urteil
    const near = [65, 75, 85, 95, 105].map((t, i) => periodCard(`v${i}`, 100 + i, [t]))
    expect(periodSentence(model([...now, ...near], { compare: { type: "previous" } }))).toBe(
      "Dein Ø je Schuss liegt 0,50 tiefer als im Zeitraum davor, nicht nachweisbar."
    )
    const same = [60, 70, 80, 90, 100].map((t, i) => periodCard(`v${i}`, 100 + i, [t]))
    const flat = model([...now, ...same], { compare: { type: "previous" } })
    expect(flat.comparison?.verdict).toBe("unclear")
    expect(periodSentence(flat)).toBe("Dein Ø je Schuss liegt gleichauf mit dem Zeitraum davor.")
    const few = model([...now.slice(0, 4), ...before], { compare: { type: "previous" } })
    expect(few.comparison?.test).toBeNull()
    expect(periodSentence(few)).toBe(
      "Für einen Vergleich mit dem Zeitraum davor sind es zu wenige Scheiben."
    )
  })

  it("ein benannter Vergleich mit Namen", () => {
    // die Scheiben 100 bis 104 Tage vor jetzt liegen zwischen dem 18. und 22. Juni, in „Vorbereitung“
    const m = model([...now, ...before], { compare: { type: "named", id: "lm" } })
    expect(periodSentence(m)).toBe(
      "Dein Ø je Schuss liegt 5,00 höher als in „Vorbereitung“, nachweisbar."
    )
  })

  it("ohne Vergleich: die letzte Scheibe gegen den Schnitt der 30 Tage davor", () => {
    // die letzte Scheibe (vor 10 Tagen) hat 6,0; davor 7,0 / 8,0 / 9,0 / 10,0 in den 30 Tagen → Schnitt 8,5
    const m = model(now)
    expect(m.ownAverage?.average?.delta).toBeCloseTo(-2.5, 12)
    expect(periodSentence(m)).toBe(
      "Deine letzte Scheibe lag 2,50 unter deinem Schnitt der 30 Tage davor."
    )
    expect(periodSentence(model(now.slice(0, 2)))).toBeNull()
  })

  it("Urteil in Worten: Richtung, besser oder schwächer, bedeutsam nur mit Urteil", () => {
    const base = {
      a: { n: 5, mean: 1 },
      b: { n: 5, mean: 2 },
      delta: 1,
      test: { p: 0.01, exact: true },
    }
    expect(verdictText({ ...base, verdict: "higher", meaningful: true }, "higher")).toBe(
      "höher, besser · bedeutsam"
    )
    expect(verdictText({ ...base, verdict: "higher", meaningful: false }, "lower")).toBe(
      "höher, schwächer"
    )
    expect(verdictText({ ...base, verdict: "lower", meaningful: true }, "none")).toBe(
      "tiefer · bedeutsam"
    )
    expect(verdictText({ ...base, verdict: "unclear", meaningful: true }, "higher")).toBe(
      "nicht nachweisbar"
    )
    expect(
      verdictText({ ...base, test: null, verdict: "unclear", meaningful: null }, "higher")
    ).toBe("zu wenige Scheiben")
  })
})

describe("Darstellung, Monate, Wochen, Ablesung", () => {
  const many = Array.from({ length: 60 }, (_, i) => periodCard(`k${i}`, 80 - i, [95 + (i % 5)]))

  it("ab 60 Scheiben je Monat, außer gewählt oder mit Vergleich", () => {
    expect(model(many).view).toBe("months")
    expect(model(many.slice(0, 59)).view).toBe("cards")
    expect(model(many, { view: "cards" }).view).toBe("cards")
    expect(model(many, { compare: { type: "previous" } }).view).toBe("cards")
  })

  it("Monate mit Namen in der Zeitzone", () => {
    const { months } = model(many)
    expect(months.map((m) => m.label)).toEqual(["Juli 2026", "August 2026", "September 2026"])
    expect(months.reduce((sum, m) => sum + m.n, 0)).toBe(60)
  })

  it("Wochen ohne Lücke über den ganzen Zeitraum, leere mit 0", () => {
    // 90 Tage vor dem 30. September beginnen am 2. Juli (KW 27); der 30. September liegt in KW 40
    // a am Sonntag, 27. September (KW 39), b und c am Montag und Dienstag (KW 40)
    const { weeks } = model(THREE)
    expect(weeks.map((w) => w.label)).toEqual(Array.from({ length: 14 }, (_, i) => `KW ${27 + i}`))
    expect(weeks.at(-1)).toMatchObject({ shots: 3, cards: 2, days: 2 })
    expect(weeks.at(-2)).toMatchObject({ shots: 2, cards: 1, days: 1 })
    expect(weeks[0]).toMatchObject({ shots: 0, cards: 0, days: 0 })
  })

  it("Ablesung: gewählte Scheibe, sonst die neueste", () => {
    expect(model(THREE).reading).toMatchObject({ card: { id: "c" }, chosen: false })
    expect(model(THREE, { chosen: "a" }).reading).toMatchObject({ card: { id: "a" }, chosen: true })
    expect(model(THREE, { chosen: "alt" }).reading).toMatchObject({
      card: { id: "c" },
      chosen: false,
    })
    expect(model([]).reading).toBeNull()
  })
})
