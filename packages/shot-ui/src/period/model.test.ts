import { describe, expect, it } from "vitest"

import type { NamedPeriod } from "./calendar"
import { isProbeOnly, periodModel, periodReading, PERIOD_TILE_KEYS } from "./model"
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

  it("Ergebnis: Mittel der Scheiben, nicht der Schüsse", () => {
    // je Scheibe 10,0 / 9,1 / 9,5 → 9,5333; über alle fünf Schüsse wären es 9,54
    const { summary } = model(THREE)
    expect(summary.mean).toBeCloseTo(28.6 / 3, 12)
    expect(summary.cards).toBe(3)
    expect(summary.shots).toBe(5)
  })

  it("beste Scheibe unter der häufigsten Schusszahl, bei Gleichstand die längere", () => {
    // zwei Scheiben zu 2 Schuss, eine zu 1: die beste zu 2 Schuss ist a (10,0), nicht c
    expect(model(THREE).summary.best).toMatchObject({ id: "a", shots: 2 })
    // eine kurze Scheibe mit 10,5 schlägt die längeren nicht
    const cards = [
      periodCard("kurz", 1, [105]),
      periodCard("l1", 2, [100, 98, 96]),
      periodCard("l2", 3, [99, 99, 99]),
      periodCard("k2", 4, [90]),
    ]
    expect(model(cards).summary.best).toMatchObject({ id: "l2", shots: 3 })
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
      "Dein Ø je Schuss liegt 5,00 höher als im Zeitraum davor; der Unterschied ist nachweisbar."
    )
  })

  it("ohne Urteil: nicht nachweisbar; gleichauf; unter fünf je Seite: zu wenige", () => {
    // 6,0 … 10,0 gegen 6,5 … 10,5: 0,50 tiefer, ohne Urteil
    const near = [65, 75, 85, 95, 105].map((t, i) => periodCard(`v${i}`, 100 + i, [t]))
    expect(periodSentence(model([...now, ...near], { compare: { type: "previous" } }))).toBe(
      "Dein Ø je Schuss liegt 0,50 tiefer als im Zeitraum davor; der Unterschied ist aber nicht nachweisbar."
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
      "Dein Ø je Schuss liegt 5,00 höher als in „Vorbereitung“; der Unterschied ist nachweisbar."
    )
  })

  it("ohne Vergleich: die letzte Scheibe gegen den Schnitt der 30 Tage davor", () => {
    // die letzte Scheibe (vor 10 Tagen) hat 6,0; davor 7,0 / 8,0 / 9,0 / 10,0 in den 30 Tagen → Schnitt 8,5
    const m = model(now)
    expect(m.ownAverage?.average?.delta).toBeCloseTo(-2.5, 12)
    expect(periodSentence(m)).toBe(
      "Deine neueste Scheibe lag im Ø je Schuss 2,50 unter deinem Schnitt der 30 Tage davor."
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

  it("Boden und Decke nach der Richtung der Kennzahl", () => {
    // zehn Scheiben im September mit verschieden weiten Gruppen: σ unterscheidet sich je Scheibe
    const rich = Array.from({ length: 10 }, (_, i) =>
      periodCard(`r${i}`, 5 + i, [95, 96, 97, 98, 99], { spreadUm: 100 * (i + 1) })
    )
    const mean = model(rich).months[0]
    expect(mean.floor).toBe(mean.p10)
    expect(mean.ceiling).toBe(mean.p90)
    // bei σ ist kleiner besser: der Boden ist das P90 (die weitesten Scheiben)
    const sigma = model(rich, { metric: "group.sigma" }).months[0]
    expect(sigma.p90).toBeGreaterThan(sigma.p10 as number)
    expect(sigma.floor).toBe(sigma.p90)
    expect(sigma.ceiling).toBe(sigma.p10)
    // beim Tempo gibt es kein besser: keine Namen, nur die Spanne
    const tempo = model(rich, { metric: "time.intervalMedian" }).months[0]
    expect(tempo.floor).toBeNull()
    expect(tempo.ceiling).toBeNull()
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

  it("Abstand zum Schnitt der bis zu fünf Scheiben davor, ohne sie selbst, auch vor dem Zeitraum", () => {
    // alt (10,9) liegt vor dem Zeitraum und zählt für a mit; b gegen alt und a, c gegen alt, a und b
    const { deltas } = model(THREE)
    expect(deltas.get("a")).toEqual({ delta: expect.closeTo(10 - 10.9, 12), n: 1 })
    expect(deltas.get("b")?.delta).toBeCloseTo(9.1 - (10.9 + 10) / 2, 12)
    expect(deltas.get("c")).toEqual({ delta: expect.closeTo(9.5 - 30 / 3, 12), n: 3 })
    expect(deltas.has("alt")).toBe(false)
    // die erste Scheibe der Familie hat keinen Schnitt davor
    expect(model(THREE.slice(0, 3)).deltas.has("a")).toBe(false)
    // höchstens fünf davor
    expect(model(many).deltas.get("k10")?.n).toBe(5)
  })

  it("gegen den Schnitt über alle Scheiben der Familie bis zur neuesten im Zeitraum", () => {
    // benannter Zeitraum Mai bis Juni: die neueste Scheibe dort, nicht die von heute
    const may = [100, 101, 102, 103].map((t, i) => periodCard(`m${i}`, 120 - i, [t]))
    const today = periodCard("heute", 1, [80])
    const m = model([...may, today], { choice: { type: "named", id: "lm" } })
    expect(m.ownAverage?.last.id).toBe("m3")
    expect(m.ownAverage?.average).toMatchObject({ n: 3 })
    // Perzentil über die letzten 50 der Familie, nicht nur über den Zeitraum
    const long = Array.from({ length: 30 }, (_, i) => periodCard(`f${i}`, 200 - i, [95]))
    const short = model([...long, ...THREE], { choice: { type: "rolling", days: 30 } })
    expect(short.ownAverage?.percentile).not.toBeNull()
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

describe("Befunde aus dem Review (9. Oktober 2026)", () => {
  const probe = periodCard("p", 0.5, [100, 100, 100], { probe: true })

  it("überlappende Zeiträume: der Vergleich ohne die gemeinsamen Scheiben", () => {
    // „Letzte 12 Monate“ enthält „Vorbereitung“ ganz: ohne die gemeinsamen bleibt im Vergleich nichts
    const may = [100, 99, 98, 97, 96].map((t, i) => periodCard(`m${i}`, 120 - i, [t]))
    const m = model([...THREE, ...may], {
      choice: { type: "rolling", days: 365 },
      compare: { type: "named", id: "lm" },
    })
    expect(m.compareShared).toBe(5)
    expect(m.compareValues).toEqual([])
    expect(m.comparison).toBeNull()
    expect(periodSentence(m)).toBe(
      "Für einen Vergleich mit „Vorbereitung“ sind es zu wenige Scheiben."
    )
    // ohne Überlappung zählt nichts doppelt
    expect(model(THREE, { compare: { type: "previous" } }).compareShared).toBe(0)
  })

  it("eine neueste Scheibe: Ablesung, Satz und „gegen deinen Schnitt“ meinen dieselbe", () => {
    // die Scheibe nur aus Probe zählt ohne den Schalter nicht: die neueste mit Wert ist c
    const m = model([...THREE, probe], { includeProbeOnly: false })
    expect(m.reading?.card.id).toBe("c")
    expect(m.ownAverage?.last.id).toBe("c")
    // mit dem Schalter (der Vorgabe) zählt sie und ist die neueste
    expect(model([...THREE, probe]).reading?.card.id).toBe("p")
  })

  it("Ergebnis, Vergleich und eigener Schnitt bleiben im Ø je Schuss, auch wenn der Verlauf σ zeigt", () => {
    const cards = [
      ...THREE.map((c) => ({ ...c })),
      ...[95, 96, 97].map((t, i) => periodCard(`s${i}`, 4 + i, [t, t, t])),
    ]
    const mean = model(cards)
    const sigma = model(cards, { metric: "group.sigma" })
    expect(sigma.metric.key).toBe("group.sigma")
    expect(sigma.summary).toEqual(mean.summary)
    expect(sigma.ownAverage).toEqual(mean.ownAverage)
    const now = [60, 70, 80, 90, 100].map((t, i) =>
      periodCard(`n${i}`, 10 + i, [t, t, t], { spreadUm: 100 * (i + 1) })
    )
    const before = [10, 20, 30, 40, 50].map((t, i) =>
      periodCard(`v${i}`, 100 + i, [t, t, t], { spreadUm: 100 })
    )
    const compared = { compare: { type: "previous" } as const }
    expect(model([...now, ...before], { ...compared, metric: "group.sigma" }).comparison).toEqual(
      model([...now, ...before], compared).comparison
    )
  })

  it("nur Probe: eine Regel; die Zahl der nicht gezählten Scheiben im Modell", () => {
    expect(isProbeOnly(probe)).toBe(true)
    expect(isProbeOnly(THREE[0])).toBe(false)
    expect(isProbeOnly(periodCard("leer", 1, []))).toBe(false)
    expect(model([...THREE, probe], { includeProbeOnly: false }).excludedProbeOnly).toBe(1)
    expect(model([...THREE, probe]).excludedProbeOnly).toBe(0)
  })

  it("Ablesung aus dem Modell und einer Wahl, ohne das Modell neu zu rechnen", () => {
    const m = model(THREE)
    expect(periodReading(m, "a")).toMatchObject({ card: { id: "a" }, chosen: true })
    expect(periodReading(m, null)).toMatchObject({ card: { id: "c" }, chosen: false })
    expect(periodReading(m, "weg")).toMatchObject({ card: { id: "c" }, chosen: false })
  })
})
