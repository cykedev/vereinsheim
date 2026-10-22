import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"
import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import type { CompareModel, CompareRow } from "./model"
import {
  basisText,
  cardSideNames,
  COMPARE_KINDS,
  COMPARE_TYPES,
  compareSentence,
  emptySideText,
  KIND_NAMES,
  missingReason,
  periodSideName,
  pictureLegend,
  positionValue,
  positionClear,
  problemText,
  tableNote,
  goldSide,
} from "./words"

const TZ = "Europe/Berlin"
/** die Fachbegriffe der ersten beiden Ebenen, wie `JARGON` der Skriptprüfung */
const JARGON = /σ|Hotelling|Mann-Whitney|\b[Uu]nklar\b|\b[Ee]cht(e[nmrs]?)?\b/

const comparison = (
  delta: number,
  verdict: PeriodComparison["verdict"],
  test = true
): PeriodComparison => ({
  a: { n: 10, mean: 9 + delta },
  b: { n: 10, mean: 9 },
  delta,
  basis: "cards",
  test: test ? { p: verdict === "unclear" ? 0.4 : 0.01, exact: true } : null,
  verdict,
  meaningful: null,
})

const row = (
  key: string,
  better: CompareRow["better"],
  c: PeriodComparison | null
): CompareRow => ({
  key,
  label: key,
  unit: "Ringe",
  decimals: 2,
  better,
  a: 9.5,
  b: 9.3,
  comparison: c,
})

const model = (over: Partial<CompareModel> = {}): CompareModel => ({
  type: "periods",
  unit: "card",
  a: {
    name: "Letzte 90 Tage",
    at: "in den letzten 90 Tagen",
    short: "90 Tage",
    cards: 10,
    shots: 398,
    withoutPosition: 0,
  },
  b: {
    name: "Zeitraum davor",
    at: "im Zeitraum davor",
    short: "davor",
    cards: 8,
    shots: 300,
    withoutPosition: 0,
  },
  shared: 0,
  result: row("result.decimalMean", "higher", comparison(0.12, "higher")),
  spread: row("group.sigma", "lower", comparison(0, "unclear")),
  position: {
    a: { n: 10, center: { xUm: 0, yUm: 0 } },
    b: { n: 8, center: { xUm: 0, yUm: 0 } },
    shiftUm: { xUm: 0, yUm: 0 },
    distanceUm: 400,
    p: 0.5,
    verdict: "none",
  },
  metrics: [],
  picture: {
    style: "dots",
    halfUm: 1000,
    focus: null,
    a: { kind: "dots" as const, points: [[0, 0]], center: null },
    b: { kind: "dots" as const, points: [], center: null },
  },
  ...over,
})

describe("Namen der Seiten", () => {
  const range = (label: string) => ({ fromMs: 0, toMs: 1, label })

  it("Zeiträume im Satz mit Präposition", () => {
    expect(periodSideName({ type: "rolling", days: 90 }, range("Letzte 90 Tage"))).toEqual({
      name: "Letzte 90 Tage",
      at: "in den letzten 90 Tagen",
      short: "90 Tage",
    })
    expect(periodSideName({ type: "rolling", days: 182 }, range("Letzte 6 Monate")).at).toBe(
      "in den letzten 6 Monaten"
    )
    expect(periodSideName({ type: "rolling", days: 365 }, range("Letzte 12 Monate")).at).toBe(
      "in den letzten 12 Monaten"
    )
    expect(periodSideName("previous", range("egal"))).toEqual({
      name: "Zeitraum davor",
      at: "im Zeitraum davor",
      short: "davor",
    })
    expect(periodSideName({ type: "named", id: "lm" }, range("Vorbereitung LM")).at).toBe(
      "in „Vorbereitung LM“"
    )
    expect(
      periodSideName(
        { type: "free", from: "2026-07-01", to: "2026-09-30" },
        range("01.07.2026 – 30.09.2026")
      ).at
    ).toBe("vom 01.07.2026 bis 30.09.2026")
    expect(periodSideName({ type: "all" }, range("Alles")).at).toBe("in allem")
    expect(KIND_NAMES.a.at).toBe("im Wettkampf")
    // kurz über den Spalten
    expect(
      periodSideName(
        { type: "free", from: "2026-07-01", to: "2026-09-30" },
        range("01.07.2026 – 30.09.2026")
      ).short
    ).toBe("01.07.–30.09.")
    expect(periodSideName({ type: "rolling", days: 182 }, range("Letzte 6 Monate")).short).toBe(
      "6 Monate"
    )
    expect(periodSideName({ type: "rolling", days: 365 }, range("Letzte 12 Monate")).at).toBe(
      "in den letzten 12 Monaten"
    )
    expect(KIND_NAMES.b.short).toBe("Training")
  })

  it("Scheiben: Wochentag, Tag und Ergebnis im Chip, der Tag im Satz, am selben Tag mit Uhrzeit", () => {
    const friday = Date.UTC(2026, 9, 9, 17, 42)
    const names = cardSideNames(
      { startedAtMs: friday, total: "362,4" },
      { startedAtMs: Date.UTC(2026, 9, 2, 17), total: "365,1" },
      TZ
    )
    expect(names.a).toEqual({ name: "Fr 09.10., 362,4", at: "am 09.10.", short: "09.10." })
    const same = cardSideNames(
      { startedAtMs: friday, total: null },
      { startedAtMs: friday + 3_600_000, total: null },
      TZ
    )
    expect(same.a.at).toBe("am 09.10. um 19:42")
    expect(same.a.short).toBe("19:42")
    expect(same.b.name).toBe("Fr 09.10.")
  })
})

describe("der Satz", () => {
  it("klarer Unterschied", () => {
    expect(compareSentence(model())).toEqual({
      lead: "In den letzten 90 Tagen 0,12 Ringe je Schuss mehr als im Zeitraum davor. Das ist ein klarer Unterschied.",
      more: "Streuung und Lage zeigen keinen klaren Unterschied.",
    })
  })

  it("ohne Urteil, weniger", () => {
    const m = model({ result: row("result.decimalMean", "higher", comparison(-0.07, "unclear")) })
    expect(compareSentence(m).lead).toBe(
      "In den letzten 90 Tagen 0,07 Ringe je Schuss weniger als im Zeitraum davor. Ein klarer Unterschied ist das nicht."
    )
  })

  it("gleich viele", () => {
    const m = model({ result: row("result.decimalMean", "higher", comparison(0.001, "unclear")) })
    expect(compareSentence(m).lead).toBe(
      "In den letzten 90 Tagen gleich viele Ringe je Schuss wie im Zeitraum davor."
    )
  })

  it("zu wenige Scheiben, bei zwei Scheiben zu wenige Schüsse", () => {
    const few = row("result.decimalMean", "higher", comparison(0.3, "unclear", false))
    expect(compareSentence(model({ result: few })).lead).toBe(
      "Für einen Vergleich sind es zu wenige Scheiben."
    )
    expect(compareSentence(model({ result: few, unit: "shot" })).lead).toBe(
      "Für einen Vergleich sind es zu wenige Schüsse."
    )
  })

  it("Streuung klar und Lage versetzt", () => {
    const m = model({
      spread: row("group.sigma", "lower", comparison(-0.3, "lower")),
      position: {
        ...model().position!,
        shiftUm: { xUm: -800, yUm: 760 },
        distanceUm: 1100,
        verdict: "shifted",
      },
    })
    expect(compareSentence(m).more).toBe(
      "Die Streuung ist in den letzten 90 Tagen klar kleiner. Die Mitte lag in den letzten 90 Tagen 1,1 mm weiter links oben."
    )
  })

  it("endet eine Seite mit einem Datum, steht nur ein Punkt", () => {
    const names = {
      a: { ...model().a, name: "Fr 02.10.", at: "am 02.10." },
      b: { ...model().b, name: "Di 29.09.", at: "am 29.09." },
    }
    expect(compareSentence(model(names)).lead).toBe(
      "Am 02.10. 0,12 Ringe je Schuss mehr als am 29.09. Das ist ein klarer Unterschied."
    )
    const level = row("result.decimalMean", "higher", comparison(0, "unclear"))
    expect(compareSentence(model({ ...names, result: level })).lead).toBe(
      "Am 02.10. gleich viele Ringe je Schuss wie am 29.09."
    )
    const spread = row("group.sigma", "lower", comparison(-0.3, "lower"))
    expect(compareSentence(model({ ...names, spread })).more).toBe(
      "Die Streuung ist am 02.10. klar kleiner."
    )
  })

  it("eine leere Seite", () => {
    const empty = { ...model().b, cards: 0 }
    expect(compareSentence(model({ b: empty })).lead).toBe(
      "Zeitraum davor hat keine Scheibe. Wähle einen anderen Zeitraum."
    )
    expect(emptySideText(model({ type: "kind", a: { ...model().a, cards: 0 } }))).toBe(
      "In diesem Zeitraum gibt es keinen Wettkampf."
    )
    expect(emptySideText(model({ type: "kind", b: empty }))).toBe(
      "In diesem Zeitraum gibt es kein Training."
    )
  })
})

describe("Zeilen, Grundlage, Bild", () => {
  it("Gold für den klar besseren Wert nach der Richtung der Kennzahl", () => {
    expect(goldSide(row("result.decimalMean", "higher", comparison(0.2, "higher")))).toBe("a")
    expect(goldSide(row("result.decimalMean", "higher", comparison(-0.2, "lower")))).toBe("b")
    // σ: kleiner ist besser, A höher heißt B besser
    expect(goldSide(row("group.sigma", "lower", comparison(0.2, "higher")))).toBe("b")
    // σ: A tiefer heißt A besser
    expect(goldSide(row("group.sigma", "lower", comparison(-0.2, "lower")))).toBe("a")
    expect(goldSide(row("time.intervalMedian", "none", comparison(5, "higher")))).toBeNull()
    expect(goldSide(row("group.sigma", "lower", comparison(0, "unclear")))).toBeNull()
    expect(goldSide(row("group.sigma", "lower", comparison(0.3, "unclear", false)))).toBeNull()
    expect(goldSide(row("group.sigma", "lower", null))).toBeNull()
  })

  it("Lage: Abstand, Gold nur bei klarem Versatz", () => {
    expect(positionValue(model())).toBe("0,4 mm auseinander")
    expect(positionClear(model())).toBe(false)
    expect(positionClear(model({ position: { ...model().position!, verdict: "shifted" } }))).toBe(
      true
    )
    expect(positionClear(model({ position: null }))).toBe(false)
  })

  it("die Zeile unter der Tabelle", () => {
    expect(tableNote(model())).toBe(
      "Gold heißt: ein klarer Unterschied, dieser Wert ist besser. Sonst ist kein Unterschied belegt."
    )
    const few = row("result.decimalMean", "higher", comparison(0.3, "unclear", false))
    expect(tableNote(model({ result: few, unit: "shot" }))).toBe(
      "Für ein Urteil sind es zu wenige Schüsse."
    )
  })

  it("„–“ mit Grund", () => {
    expect(missingReason({ key: "group.sigma" })).toBe("Ohne Lage der Schüsse.")
    expect(missingReason({ key: "time.intervalMedian" })).toBe("Ohne Zeit der Schüsse.")
    expect(missingReason({ key: "result.decimalMean" })).toBe("Ohne Wertungsschuss.")
  })

  it("Grundlage", () => {
    expect(basisText(model())).toBe("A: 10 Scheiben, 398 Schuss. B: 8 Scheiben, 300 Schuss.")
    expect(
      basisText(model({ shared: 3, a: { ...model().a, shots: 1240, withoutPosition: 2 } }))
    ).toBe(
      "A: 10 Scheiben, 1.240 Schuss, 2 ohne Lage. B: 8 Scheiben, 300 Schuss. 3 Scheiben liegen in beiden Zeiträumen. Sie zählen nur in A."
    )
    expect(basisText(model({ shared: 1 }))).toContain(
      "1 Scheibe liegt in beiden Zeiträumen. Sie zählt nur in A."
    )
    expect(
      basisText(
        model({ unit: "shot", a: { ...model().a, shots: 40 }, b: { ...model().b, shots: 40 } })
      )
    ).toBe("Verglichen Schuss für Schuss: 40 gegen 40 Wertungsschüsse.")
  })

  it("Legende und Hinweise", () => {
    const grid = { size: 1, cells: [0], levels: [0, 0, 0, 0, 0, 0] }
    const center = { xUm: 0, yUm: 0 }
    expect(
      pictureLegend({
        style: "outlines",
        halfUm: 1,
        focus: { xUm: 0, yUm: 0, radiusUm: 1 },
        a: { kind: "outline" as const, grid, center },
        b: { kind: "outline" as const, grid, center },
      })
    ).toBe("Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10.")
    expect(
      pictureLegend({
        ...model().picture,
        style: "mixed",
        b: { kind: "outline" as const, grid, center },
      })
    ).toBe(
      "Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10. Die kleinere Seite steht mit jedem Schuss als Punkt."
    )
    expect(pictureLegend(model().picture)).toBe(
      "Jeder Punkt ist ein Schuss. Der Ringwert steht in den Zahlen."
    )
    expect(
      pictureLegend({
        style: "dots",
        halfUm: 1,
        focus: null,
        a: { kind: "dots" as const, points: [], center: null },
        b: { kind: "dots" as const, points: [], center: null },
      })
    ).toBe("Für das Bild fehlen die Lagen der Schüsse.")
    expect(problemText("missing")).toBe("Wähle zwei Scheiben.")
    expect(problemText("same")).toBe("Wähle zwei verschiedene Scheiben.")
    expect(problemText("families")).toBe(
      "Die beiden Scheiben gehören zu verschiedenen Disziplinen. Wähle zwei aus einer."
    )
  })

  it("keine Semikolons, keine drei Punkte, keine Fachbegriffe", () => {
    const m = model({
      spread: row("group.sigma", "lower", comparison(0.3, "higher")),
      position: { ...model().position!, shiftUm: { xUm: 0, yUm: -900 }, verdict: "shifted" },
    })
    const texts = [
      ...Object.values(compareSentence(m)).filter((t): t is string => t !== null),
      tableNote(m),
      basisText(m),
      pictureLegend(m.picture),
      problemText("families"),
      emptySideText(model({ b: { ...model().b, cards: 0 } })) as string,
      ...COMPARE_TYPES.map((t) => t.label),
      ...COMPARE_KINDS.map((k) => k.label),
    ]
    expect(forbiddenIn(texts, JARGON)).toEqual([])
  })
})
