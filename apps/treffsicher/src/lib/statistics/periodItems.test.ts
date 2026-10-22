import { periodModel } from "@vereinsheim/shot-ui/period/model"
import { recordRows } from "@vereinsheim/shot-ui/period/records"
import { initialPeriodState } from "@vereinsheim/shot-ui/period/state"
import { describe, expect, it } from "vitest"

import { periodItem, periodItems, type SessionForPeriod } from "@/lib/statistics/periodItems"

const NOW = Date.UTC(2026, 9, 1, 10)
const DAY = 86_400_000

const TENTH = { shotsPerSeries: 10, scoringType: "TENTH" }
const WHOLE = { shotsPerSeries: 10, scoringType: "WHOLE" }

const shots = (...values: number[]) => values.map((v) => v.toFixed(1))
const sum = (values: readonly string[]) => values.reduce((s, v) => s + Number(v), 0)

function session(
  id: string,
  daysAgo: number,
  series: { shots?: string[] | null; total?: number | null; practice?: boolean }[],
  extra: Partial<SessionForPeriod> = {}
): SessionForPeriod {
  return {
    id,
    date: new Date(NOW - daysAgo * DAY),
    type: "TRAINING",
    discipline: TENTH,
    hitLocationHorizontalMm: null,
    hitLocationHorizontalDirection: null,
    hitLocationVerticalMm: null,
    hitLocationVerticalDirection: null,
    series: series.map((s, i) => ({
      position: i + 1,
      isPractice: s.practice ?? false,
      shots: s.shots ?? null,
      scoreTotal: s.total !== undefined ? s.total : s.shots ? sum(s.shots) : null,
    })),
    ...extra,
  }
}

/**
 * Probe mit lauter 10,9 vor der Wertung; eine Serie zu zehn um 9,0 und eine kurze zu fünf um 10,4. Über die
 * Wertungsschüsse ist der Ø 9,4667; mit Probe wäre er höher, als Mittel der beiden Serien 9,7
 */
const MIXED = session("gemischt", 1, [
  { shots: shots(10.9, 10.9, 10.9, 10.9, 10.9), practice: true },
  { shots: shots(8.6, 8.8, 9.0, 9.2, 9.4, 8.6, 8.8, 9.0, 9.2, 9.4) },
  { shots: shots(10.2, 10.3, 10.4, 10.5, 10.6) },
])

describe("eine Einheit als Eintrag der Seite eines Zeitraums", () => {
  it("Ø je Schuss über die Wertungsschüsse: ohne Probe, nicht als Mittel der Serien", () => {
    const item = periodItem(MIXED)!
    expect(item.metrics["result.decimalMean"]?.value).toBeCloseTo(142 / 15, 8)
    expect(item.metrics["result.decimalMean"]?.n).toBe(15)
    // mit Einzelschüssen die Streuung der Schusswerte für die Rechnung über zwei Ebenen
    expect(item.metrics["result.decimalMean"]?.sd).toBeGreaterThan(0)
    expect(item.shots).toBe(15)
    expect(item.withShots).toBe(true)
    expect(item.probeOnly).toBe(false)
    // ganze Ringe aus den Zehnteln: 8 8 9 9 9 8 8 9 9 9 + 10 × 5 = 136
    expect(item.metrics["result.ringsMean"]?.value).toBeCloseTo(136 / 15, 8)
    expect(item.metrics["result.tens"]?.value).toBe(5)
  })

  it("Wertung aus der Disziplin: Zehntel mit beiden Wertungen, ganze Ringe nur in ganzen Ringen", () => {
    expect(periodItem(MIXED)!.scoring).toBe("decimal")
    const whole = periodItem(
      session("ganz", 1, [{ shots: ["9", "10", "8", "10", "9"] }], { discipline: WHOLE })
    )!
    expect(whole.scoring).toBe("rings")
    expect(whole.metrics["result.ringsMean"]?.value).toBeCloseTo(9.2, 10)
    expect(whole.metrics["result.decimalMean"] ?? null).toBeNull()
    expect(whole.records.decimal).toBeNull()
    expect(whole.records.rings?.result).toBe(46)
  })

  it("ohne Lage je Schuss: keine Innenzehner, kein Teiler, keine engste Gruppe", () => {
    const item = periodItem(MIXED)!
    expect(item.metrics["result.innerTens"] ?? null).toBeNull()
    expect(item.metrics["group.sigma"] ?? null).toBeNull()
    const candidates = item.records.decimal!
    expect(candidates.innerTens).toBeNull()
    expect(candidates.seriesInnerTens).toBeNull()
    expect(candidates.bestTeiler).toBeNull()
    expect(candidates.tightest).toBeNull()
    expect(candidates.tightestSeries).toBeNull()
    expect(candidates.perfect).toBeNull()
    expect(candidates.n).toBe(15)
  })

  it("ohne Einzelschüsse: Ergebnis und Ø je Schuss aus den Serien, n = Serien × Schuss je Serie", () => {
    const item = periodItem(
      session("summen", 2, [{ total: 95.4 }, { total: 97.0 }, { total: 120, practice: true }])
    )!
    expect(item.withShots).toBe(false)
    expect(item.metrics["result.decimal"]).toEqual({ value: 192.4, n: 20 })
    expect(item.metrics["result.decimalMean"]?.value).toBeCloseTo(9.62, 10)
    expect(item.metrics["result.decimalMean"]?.n).toBe(20)
    // ohne Einzelschüsse keine Streuung der Schusswerte: Das Urteil bleibt der Rangtest über die Einheiten
    expect(item.metrics["result.decimalMean"]?.sd).toBeUndefined()
    expect(item.metrics["result.ringsMean"] ?? null).toBeNull()
    expect(item.metrics["result.tens"] ?? null).toBeNull()
    expect(item.records).toEqual({ decimal: null, rings: null })
    expect(item.shots).toBe(20)
  })

  it("ganze Ringe ohne Einzelschüsse: das eingetragene Ergebnis gilt, auch mit Zehntel", () => {
    const item = periodItem(
      session("zehntel", 2, [{ total: 94.5 }, { total: 95.6 }, { total: 96 }], {
        discipline: WHOLE,
      })
    )!
    expect(item.scoring).toBe("rings")
    expect(item.metrics["result.rings"]).toEqual({ value: 286.1, n: 30 })
    expect(item.metrics["result.ringsMean"]?.value).toBeCloseTo(286.1 / 30, 10)
  })

  it("leere Serien zählen nicht", () => {
    const empty = {
      ...MIXED,
      series: [...MIXED.series, { position: 4, isPractice: false, scoreTotal: null, shots: null }],
    }
    expect(periodItem(empty)).toEqual(periodItem(MIXED))
  })

  it("fehlen einer Wertungsserie die Schüsse, rechnet die Einheit wie ohne Einzelschüsse", () => {
    const item = periodItem(
      session("teils", 2, [{ shots: shots(9, 9, 9, 9, 9, 9, 9, 9, 9, 9) }, { total: 100 }])
    )!
    expect(item.withShots).toBe(false)
    expect(item.metrics["result.decimalMean"]?.value).toBeCloseTo(9.5, 10)
    // je Serie ihre Einzelschüsse, sonst der Schuss je Serie der Disziplin: 5 + 10
    const short = periodItem(session("kurz", 2, [{ shots: shots(9, 9, 9, 9, 9) }, { total: 100 }]))!
    expect(short.metrics["result.decimalMean"]).toEqual({ value: 145 / 15, n: 15 })
    expect(short.shots).toBe(15)
  })

  it("Art, Lage aus dem Ausdruck und Einheiten ohne Disziplin oder Ergebnis", () => {
    const match = periodItem(
      session("wk", 1, [{ total: 90 }], {
        type: "WETTKAMPF",
        hitLocationHorizontalMm: 1.5,
        hitLocationHorizontalDirection: "LEFT",
        hitLocationVerticalMm: 0.8,
        hitLocationVerticalDirection: "HIGH",
      })
    )!
    expect(match.kind).toBe("competition")
    expect(match.location).toEqual({ xMm: -1.5, yMm: 0.8 })
    // die Lage als Schwerpunkt-Abstand (L2), der Kennzahl von Kachel und Verlauf: √(1,5² + 0,8²) = 1,7
    expect(match.metrics["group.mpiDistance"]).toEqual({ value: 1.7, n: 10 })
    expect(periodItem(MIXED)!.location).toBeNull()
    expect(periodItem(MIXED)!.metrics["group.mpiDistance"]).toBeUndefined()
    expect(periodItem({ ...MIXED, discipline: null })).toBeNull()
    expect(periodItem(session("leer", 1, [{ total: null }]))).toBeNull()
  })
})

describe("Einheiten im Modell des Zeitraums", () => {
  const sessions = [
    MIXED,
    session("summen", 2, [{ total: 95.4 }, { total: 97.0 }]),
    session("alt", 200, [{ shots: shots(10.9, 10.8, 10.7, 10.9, 10.6) }]),
    session("trocken", 3, [], { type: "TROCKENTRAINING", discipline: null }),
  ]
  const model = periodModel({
    items: periodItems(sessions),
    state: initialPeriodState({ family: "d1", scoring: "decimal" }),
    nowMs: NOW,
    timeZone: "Europe/Berlin",
    named: [],
  })

  it("Ø je Schuss je Einheit, Rekorde nur aus Einheiten mit Einzelschüssen", () => {
    expect(model.cards.map((c) => c.id)).toEqual(["summen", "gemischt"])
    expect(model.summary.shots).toBe(35)
    const rows = recordRows(model.records, "decimal")
    expect(new Set(rows.map((r) => r.record.cardId))).toEqual(new Set(["gemischt", "alt"]))
    expect(rows.some((r) => r.key.startsWith("R3") || r.key.startsWith("R4"))).toBe(false)
    // R5: die meisten 10,9 nur über Wertungsschüsse: „alt“ mit zwei, die Probe von „gemischt“ zählt nicht
    expect(rows.find((r) => r.key.startsWith("R5"))?.record.cardId).toBe("alt")
  })
})
