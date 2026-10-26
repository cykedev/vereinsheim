// Scheiben mit Angaben ohne oder neben Einzelschüssen ([[adr-033]]): Werte, Rekorde und Umfang aus Serien-Summen, dem
// Gesamtergebnis und der Trefferlage als Summe. Erfundene Scheiben, Erwartungen von Hand gerechnet.

import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import {
  CASCADE,
  CENTER_TOTAL,
  EMPTY,
  INCOMPLETE,
  SERIES_TENTHS,
  SHOTS_RINGS,
  sumsCard,
  TOTAL_RINGS,
  TREFFSICHER,
} from "../__fixtures__/sums"
import { inScoring, metricByKey, type MetricDefinition, type Scoring } from "../metrics"
import { compareValues } from "./levels"
import { cardValues, trainingVolume, type PeriodCard } from "./period"
import { cardRecordCandidates, periodRecords } from "./records"

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>
const values = (c: PeriodCard, key: string, scoring: Scoring = "rings") =>
  cardValues([c], metric(key), scoring)

describe("Werte aus Summen", () => {
  it("nur Gesamtergebnis in ganzen Ringen: Ergebnis und Ø je Schuss, ohne Streuung der Schusswerte", () => {
    expect(values(TOTAL_RINGS, "result.rings")).toEqual([
      { id: "total-rings", atMs: DAY, value: 371, n: 40 },
    ])
    const [mean] = values(TOTAL_RINGS, "result.ringsMean")
    expect(mean).toEqual({ id: "total-rings", atMs: DAY, value: 9.275, n: 40 })
    expect("sd" in mean).toBe(false)
    expect(values(TOTAL_RINGS, "result.decimal", "decimal")).toEqual([])
    expect(values(TOTAL_RINGS, "result.tens")).toEqual([])
  })

  it("Serien-Summen in Zehnteln: Ergebnis und Ø in Zehnteln, keine ganzen Ringe, beste Serie", () => {
    expect(values(SERIES_TENTHS, "result.decimal", "decimal")[0]?.value).toBe(395.4)
    expect(values(SERIES_TENTHS, "result.decimalMean", "decimal")[0]?.value).toBe(9.885)
    expect(values(SERIES_TENTHS, "result.rings")).toEqual([])
    const candidates = cardRecordCandidates(SERIES_TENTHS, "decimal")
    expect(candidates?.bestSeries).toEqual({ length: 10, value: 100.2, series: 4 })
    expect(candidates?.n).toBe(40)
  })

  it("Schüsse in ganzen Ringen ohne Lage: Ergebnis und Zehner, keine Innenzehner, keine Zehntel", () => {
    expect(values(SHOTS_RINGS, "result.rings")[0]?.value).toBe(94)
    const tens = values(SHOTS_RINGS, "result.tens")[0]?.value ?? null
    expect(tens).not.toBeNull()
    expect(tens).toBe(5)
    expect(values(SHOTS_RINGS, "result.innerTens")).toEqual([])
    expect(values(SHOTS_RINGS, "result.decimal", "decimal")).toEqual([])
  })

  it("Kaskade: was die Schüsse nicht geben, kommt aus den Summen", () => {
    expect(values(CASCADE, "result.decimal", "decimal")[0]?.value).toBe(97.8)
    expect(values(CASCADE, "result.rings")[0]?.value).toBe(94)
  })

  it("Trefferlage als Summe: nur der Schwerpunkt-Abstand, keine Streuung", () => {
    expect(values(CENTER_TOTAL, "group.mpiDistance")).toEqual([
      { id: "center-total", atMs: 5 * DAY, value: 1.3, n: 40 },
    ])
    for (const key of ["group.sigma", "group.enclosingDiameter", "group.r50"]) {
      expect(values(CENTER_TOTAL, key)).toEqual([])
    }
  })

  it("Schüsse ohne Lage und eine Trefferlage (wie Treffsicher): der Abstand aus der Trefferlage", () => {
    expect(values(TREFFSICHER, "group.mpiDistance")).toEqual([
      { id: "treffsicher", atMs: 6 * DAY, value: 1.3, n: 10 },
    ])
  })

  it("unvollständig: im Ø je Schuss, nicht bei Rekorden", () => {
    const [mean] = values(INCOMPLETE, "result.ringsMean")
    expect(mean?.n).toBe(30)
    expect(mean?.value ?? null).not.toBeNull()
    expect(mean?.value).toBeCloseTo(280 / 30, 9)
    const records = periodRecords([INCOMPLETE], "rings")
    expect(Object.values(records.bestCard).map((r) => r.cardId)).not.toContain("incomplete")
  })
})

describe("Rekorde, Umfang und Vergleich mit Scheiben aus Summen", () => {
  it("eine vollständige Scheibe aus Summen hält den Rekord des Ergebnisses", () => {
    // 40 Schuss zu 9,5: 360 Ringe, weniger als 371
    const measured = card(
      "measured",
      9,
      Array.from({ length: 40 }, () => 95)
    )
    const records = periodRecords([TOTAL_RINGS, INCOMPLETE, measured], "rings")
    expect(records.bestCard[40]).toEqual({ value: 371, cardId: "total-rings", atMs: DAY })
    expect(records.bestCard[30]).toBeUndefined()
  })

  it("der Umfang zählt Schüsse oder die Schusszahl der Summen", () => {
    const volume = trainingVolume(
      [EMPTY, TOTAL_RINGS, SHOTS_RINGS],
      () => "alle",
      (atMs) => String(Math.floor(atMs / DAY))
    )
    expect(volume).toEqual([{ key: "alle", shots: 50, cards: 3, days: 3 }])
  })

  it("ohne Streuung der Schusswerte urteilt der Vergleich über die Scheiben", () => {
    const mean = inScoring(metric("result.ringsMean"), "rings")
    const fromSums = Array.from({ length: 5 }, (_, i) =>
      sumsCard(`sums-${i}`, 10 + i, { sums: TOTAL_RINGS.sums })
    )
    const measured = Array.from({ length: 5 }, (_, i) =>
      card(
        `measured-${i}`,
        20 + i,
        Array.from({ length: 40 }, () => 95)
      )
    )
    const compared = compareValues(
      cardValues(fromSums, mean, "rings"),
      cardValues(measured, mean, "rings"),
      mean
    )
    expect(compared?.basis).toBe("cards")
  })
})
