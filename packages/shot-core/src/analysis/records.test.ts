import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import { FLAG_SUSPICIOUS } from "../metrics"
import {
  cardRecordCandidates,
  combineRecords,
  FLAG_COUNTED_AS_MATCH,
  periodRecords,
  recordEligible,
  RECORD_EXCLUDING_FLAGS,
  type RecordCandidates,
} from "./records"

const tens = (count: number, tenths = 100) => Array<number>(count).fill(tenths)
/** Abstand zur Mitte je Schuss: der Teiler ist ein Zehntel davon */
const distances = (list: readonly number[]) => (i: number) => ({ distanceUm: list[i] })

describe("Was für Rekorde zählt", () => {
  const base = card("a", 1, tens(10))

  it("eine endgültige, vollständige Scheibe ohne Merkmal zählt", () => {
    expect(recordEligible(base)).toBe(true)
    expect(recordEligible({ ...base, flags: ["anderes"] })).toBe(true)
  })

  it("nicht vollständig, mit einem ausschließenden Merkmal oder einem verdächtigen Schuss nicht", () => {
    expect(recordEligible({ ...base, complete: false })).toBe(false)
    for (const flag of RECORD_EXCLUDING_FLAGS) {
      expect(recordEligible({ ...base, flags: [flag] }), flag).toBe(false)
    }
    const suspicious = card("s", 1, tens(10), {
      shot: (i) => (i === 4 ? { flags: [FLAG_SUSPICIOUS] } : {}),
    })
    expect(recordEligible(suspicious)).toBe(false)
  })
})

describe("Rekorde (R1–R8)", () => {
  it("R1 bestes Ergebnis je Schusszahl, in der gewählten Wertung", () => {
    const cards = [card("a", 1, tens(40)), card("b", 2, tens(60, 95)), card("c", 3, tens(40, 101))]
    const decimal = periodRecords(cards, "decimal").bestCard
    expect(Object.keys(decimal)).toEqual(["40", "60"])
    expect(decimal[40]).toMatchObject({ cardId: "c", value: 404, atMs: 3 * DAY })
    expect(decimal[60]).toMatchObject({ cardId: "b", value: 570 })
    // in ganzen Ringen ist 10,1 eine 10: Gleichstand, der frühere gilt
    expect(periodRecords(cards, "rings").bestCard[40]).toMatchObject({ cardId: "a", value: 400 })
  })

  it("Gleichstand: der frühere, am selben Tag die kleinere Kennung", () => {
    const cards = [card("b", 1, tens(10)), card("a", 1, tens(10)), card("c", 0.5, tens(10, 99))]
    expect(periodRecords(cards, "decimal").bestCard[10].cardId).toBe("a")
  })

  it("Scheiben, die nicht zählen, setzen keinen Rekord", () => {
    const cards = [card("a", 1, tens(10, 95)), card("b", 2, tens(10), { flags: ["neu-gewertet"] })]
    expect(periodRecords(cards, "decimal").bestCard[10].cardId).toBe("a")
  })

  it("R2 beste Serie voller Länge, eine kurze Restserie zählt nicht", () => {
    // Serie 1: zehn 4,0 (40,0); Serie 2: fünf 10,9 (54,5) ist kürzer als die häufigste Länge
    const records = periodRecords([card("a", 1, [...tens(10, 40), ...tens(5, 109)])], "decimal")
    expect(records.bestSeries).toEqual({
      10: { value: 40, cardId: "a", atMs: DAY, detail: "Serie 1" },
    })
  })

  it("R2 je Serienlänge: eine Scheibe in einer einzigen Serie schlägt keine Zehnerserie", () => {
    // b hat alle 40 Schuss in Serie 1 (400,0); das ist keine Serie zu zehn
    const cards = [
      card("a", 1, tens(20, 95)),
      card("b", 2, tens(40), { shot: () => ({ series: 1 }) }),
    ]
    const records = periodRecords(cards, "decimal").bestSeries
    expect(records[10]).toMatchObject({ cardId: "a", value: 95 })
    expect(records[40]).toMatchObject({ cardId: "b", value: 400 })
  })

  it("R3 bester Teiler, ohne Scheiben mit verdächtigem Schuss", () => {
    const cards = [
      card("a", 1, tens(5), { shot: distances([900, 800, 700, 600, 500]) }),
      card("b", 2, tens(5), { shot: distances([900, 800, 700, 250, 500]) }),
      card("c", 3, tens(5), {
        shot: (i) => ({ distanceUm: 10, flags: i === 0 ? [FLAG_SUSPICIOUS] : [] }),
      }),
    ]
    expect(periodRecords(cards, "decimal").bestTeiler).toEqual({
      value: 25,
      cardId: "b",
      atMs: 2 * DAY,
      detail: "Schuss 4",
    })
  })

  it("R4 engste Serie zu zehn und engste Scheibe je Schusszahl (Streukreis in mm)", () => {
    // a: zehn Schuss auf einer Linie im Abstand 0,1 mm (0,9 mm); b: Serie 1 wie a, Serie 2 im Abstand
    // 0,05 mm (0,45 mm), Serie 3 nur drei Schuss ganz eng (zählt nicht als Serie)
    const cards = [
      card("a", 1, tens(10)),
      card("b", 2, tens(23), {
        shot: (i) => ({ xUm: i < 10 ? 100 * i : i < 20 ? 50 * (i - 10) : i - 20 }),
      }),
    ]
    const records = periodRecords(cards, "decimal")
    expect(records.tightestSeries?.cardId).toBe("b")
    expect(records.tightestSeries?.detail).toBe("Serie 2")
    expect(records.tightestSeries?.value).toBeCloseTo(0.45, 9)
    expect(records.tightestCard[10].value).toBeCloseTo(0.9, 9)
    expect(records.tightestCard[23].cardId).toBe("b")
  })

  it("R4 nur über Schüsse mit Lage: fehlt einem die Lage, setzt die Scheibe keinen Streukreis-Rekord", () => {
    // b ohne den äußersten Schuss wäre 0,8 mm eng, aber ihm fehlt die Lage
    const cards = [
      card("a", 1, tens(10)),
      card("b", 2, tens(10), { shot: (i) => (i === 9 ? { xUm: null, yUm: null } : {}) }),
    ]
    const records = periodRecords(cards, "decimal")
    expect(records.tightestCard[10].cardId).toBe("a")
    expect(records.tightestSeries?.cardId).toBe("a")
  })

  it("eine Scheibe mit Probe und Wertung zählt nur mit ihren Wertungsschüssen", () => {
    // drei Probeschüsse weit außen (10,9) vor zehn Wertungsschüssen 10,0 auf einer Linie (0,9 mm)
    const mixed = card("m", 1, [109, 109, 109, ...tens(10)], {
      shot: (i) =>
        i < 3
          ? { kind: "probe", series: null, xUm: 5000 + 1000 * i }
          : { series: 1, xUm: 100 * (i - 3) },
    })
    const records = periodRecords([mixed], "decimal")
    expect(Object.keys(records.bestCard)).toEqual(["10"])
    expect(records.bestCard[10].value).toBe(100)
    expect(records.tightestCard[10].value).toBeCloseTo(0.9, 9)
    expect(records.mostPerfect).toEqual({})
    // die Nummern sind die der Wertung, wie auf der Seite der Scheibe
    expect(records.longestTenRun).toMatchObject({ value: 10, detail: "ab Schuss 1" })
  })

  it("Schussnummern wie auf der Seite der Scheibe: erst die ganze Karte ordnen, dann auswählen", () => {
    // dem Probeschuss fehlt die Abgabefolge, also ordnet die Zeit die ganze Karte: Wertung 90 (Schuss 1),
    // 100, 100 (Schuss 2 und 3); nach `seq` allein wären die Zehner Schuss 1 und 2
    const times = [0, 300, 200, 100]
    const mixed = card("m", 1, [100, 100, 100, 90], {
      shot: (i) => ({
        firedAtMs: DAY + times[i] * 1000,
        ...(i === 0 ? { kind: "probe", series: null, seq: null } : { series: 1, seq: i }),
      }),
    })
    expect(periodRecords([mixed], "decimal").longestTenRun).toMatchObject({
      value: 2,
      detail: "ab Schuss 2",
    })
  })

  it("ein verdächtiger Probeschuss vor der Wertung schließt die Scheibe nicht aus", () => {
    const mixed = card("m", 1, [100, ...tens(10)], {
      shot: (i) =>
        i === 0 ? { kind: "probe", series: null, flags: [FLAG_SUSPICIOUS] } : { series: 1 },
    })
    expect(recordEligible(mixed)).toBe(true)
    // bei einer Scheibe nur mit Probe zählt die Probe, ein verdächtiger Schuss schließt sie aus
    const probeOnly = card("p", 1, tens(10), {
      probe: true,
      shot: (i) => (i === 0 ? { flags: [FLAG_SUSPICIOUS] } : {}),
    })
    expect(recordEligible(probeOnly)).toBe(false)
  })

  it("R5 meiste 10,9 nur in Zehnteln, R6 meiste Zehner und Innenzehner je Schusszahl", () => {
    const cards = [
      card("a", 1, [109, 109, 109, 100, 90, 90, 90, 90, 90, 90]),
      card("b", 2, [109, 109, 104, 104, 104, 100, 100, 90, 90, 90]),
    ]
    const decimal = periodRecords(cards, "decimal")
    expect(decimal.mostPerfect[10]).toMatchObject({ cardId: "a", value: 3 })
    expect(decimal.mostTens[10]).toMatchObject({ cardId: "b", value: 7 })
    expect(decimal.mostInnerTens[10]).toMatchObject({ cardId: "b", value: 5 })
    expect(periodRecords(cards, "rings").mostPerfect).toEqual({})
  })

  it("ohne einen Treffer kein Rekord für Zählungen", () => {
    const records = periodRecords([card("a", 1, tens(10, 90))], "decimal")
    expect(records.mostPerfect).toEqual({})
    expect(records.mostTens).toEqual({})
    expect(records.mostInnerTens).toEqual({})
    expect(records.mostTensSeries).toEqual({})
    expect(records.mostInnerTensSeries).toEqual({})
    expect(records.longestTenRun).toBeNull()
  })

  it("R7 längste Folge von Zehnern über zwei Scheiben", () => {
    const cards = [
      card("a", 1, [100, 100, 90, 100, 100, 100]),
      card("b", 2, [100, 100, 100, 100, 90]),
    ]
    expect(periodRecords(cards, "decimal").longestTenRun).toEqual({
      value: 4,
      cardId: "b",
      atMs: 2 * DAY,
      detail: "ab Schuss 1",
    })
  })

  it("R8 beste Form: höchster voller Schnitt über fünf Scheiben, erst ab fünf", () => {
    const list = [90, 100, 80, 100, 90, 109]
    const cards = list.map((t, i) => card(`k${i + 1}`, i + 1, [t]))
    expect(periodRecords(cards.slice(0, 4), "decimal").bestForm).toBeNull()
    const best = periodRecords(cards, "decimal").bestForm
    // volle Schnitte 9,2 und 9,58
    expect(best?.cardId).toBe("k6")
    expect(best?.value).toBeCloseTo(9.58, 9)
  })

  it("nur Wettkampf, wenn gewünscht", () => {
    const cards = [card("t", 1, tens(10)), card("w", 2, tens(10, 95), { kind: "competition" })]
    expect(periodRecords(cards, "decimal").bestCard[10].cardId).toBe("t")
    expect(periodRecords(cards, "decimal", { kind: "competition" }).bestCard[10].cardId).toBe("w")
  })

  it("eine Trainingsscheibe nur mit Probe zählt nur mit includeProbeOnly", () => {
    const cards = [
      card("a", 1, tens(20, 95), { shot: () => ({ distanceUm: 500 }) }),
      card("p", 2, [...tens(10, 95), ...tens(10, 100)], {
        probe: true,
        shot: (i) => ({ distanceUm: i === 12 ? 20 : 600 }),
      }),
    ]
    const without = periodRecords(cards, "decimal")
    expect(without.bestTeiler?.cardId).toBe("a")
    expect(without.bestSeries[10].value).toBe(95)
    const withProbe = periodRecords(cards, "decimal", { includeProbeOnly: true })
    expect(withProbe.bestTeiler).toMatchObject({ cardId: "p", value: 2, detail: "Schuss 13" })
    expect(withProbe.bestSeries[10]).toMatchObject({ cardId: "p", value: 100, detail: "Serie 2" })
  })

  it("Probe, die als Wertung zählt (SF-05), nur mit includeProbeOnly", () => {
    const cards = [
      card("a", 1, tens(10, 95)),
      card("w", 2, tens(10), { flags: [FLAG_COUNTED_AS_MATCH] }),
    ]
    expect(periodRecords(cards, "decimal").bestCard[10].cardId).toBe("a")
    expect(periodRecords(cards, "decimal", { includeProbeOnly: true }).bestCard[10].cardId).toBe(
      "w"
    )
  })
})

describe("Rekorde je Serie, Folge ab 9, schwächster Schuss, Spanne (R6, R7, R10, R11)", () => {
  /** eine Serie zu zehn: so viele Schüsse mit `hit`, der Rest mit `rest` */
  const series = (count: number, hit = 100, rest = 90) => [
    ...tens(count, hit),
    ...tens(10 - count, rest),
  ]

  it("R6 meiste Zehner in einer Serie, je Serienlänge, nicht auf der Scheibe", () => {
    const cards = [
      card("a", 1, [...series(3), ...series(5)]),
      card("b", 2, [...series(4), ...series(4), ...series(4), ...series(4)]),
    ]
    const records = periodRecords(cards, "decimal")
    expect(records.mostTensSeries[10]).toEqual({
      value: 5,
      cardId: "a",
      atMs: DAY,
      detail: "Serie 2",
    })
    expect(records.mostTens[40]).toMatchObject({ cardId: "b", value: 16 })
    expect(periodRecords(cards, "rings").mostTensSeries[10]).toMatchObject({
      cardId: "a",
      value: 5,
    })
  })

  it("R6 Gleichstand zweier Serien: die frühere", () => {
    const records = periodRecords([card("a", 1, [...series(4), ...series(4)])], "decimal")
    expect(records.mostTensSeries[10]).toMatchObject({ value: 4, detail: "Serie 1" })
  })

  it("R6 meiste Innenzehner in einer Serie", () => {
    const records = periodRecords(
      [card("a", 1, [...series(1, 104), ...series(3, 104), ...series(2, 104)])],
      "decimal"
    )
    expect(records.mostInnerTensSeries[10]).toMatchObject({ value: 3, detail: "Serie 2" })
  })

  it("R6 eine kurze Restserie zählt nicht", () => {
    const records = periodRecords([card("a", 1, [...tens(20, 90), ...tens(5)])], "decimal")
    expect(records.mostTensSeries).toEqual({})
    expect(records.mostTens[25]).toMatchObject({ value: 5 })
  })

  it("R7 längste Folge ohne Schuss unter 9, in beiden Wertungen", () => {
    const cards = [card("a", 1, [95, 90, 100, 89, 91, 92, 93, 94])]
    for (const scoring of ["decimal", "rings"] as const) {
      expect(periodRecords(cards, scoring).longestNineRun, scoring).toEqual({
        value: 4,
        cardId: "a",
        atMs: DAY,
        detail: "ab Schuss 5",
      })
    }
    expect(periodRecords([card("a", 1, tens(3, 89))], "decimal").longestNineRun).toBeNull()
  })

  it("R10 bester schwächster Schuss je Schusszahl, in der Wertung", () => {
    const cards = [card("a", 1, [100, 72, 95]), card("b", 2, [100, 71, 99])]
    expect(periodRecords(cards, "decimal").bestWeakestShot[3]).toEqual({
      value: 7.2,
      cardId: "a",
      atMs: DAY,
      detail: "Schuss 2",
    })
    // in ganzen Ringen beide 7: der frühere
    expect(periodRecords(cards, "rings").bestWeakestShot[3]).toMatchObject({
      cardId: "a",
      value: 7,
    })
  })

  it("R10 fehlt einem Wertungsschuss der Wert, setzt die Scheibe keinen Rekord", () => {
    const missing = card("m", 0, [100, 99, 99], {
      shot: (i) => (i === 2 ? { decimalTenths: null, ring: null } : {}),
    })
    const records = periodRecords([missing, card("a", 1, [100, 72, 95])], "decimal")
    expect(records.bestWeakestShot[3]).toMatchObject({ cardId: "a", value: 7.2 })
  })

  it("R11 kleinste Spanne der Serien je Schusszahl, ab zwei vollen Serien", () => {
    const cards = [
      // 90 und 86
      card("a", 1, [...tens(10, 90), ...series(6, 90, 80)]),
      // 88 und 87
      card("b", 2, [...series(8, 90, 80), ...series(7, 90, 80)]),
      card("e", 3, tens(10, 90)),
    ]
    const records = periodRecords(cards, "decimal")
    expect(records.smallestSeriesSpan[20]).toEqual({ value: 1, cardId: "b", atMs: 2 * DAY })
    expect(records.smallestSeriesSpan[10]).toBeUndefined()
  })

  it("R11 auf das Raster der Wertung gerundet: 89,3 − 85,4 ist 3,9 wie 90,0 − 86,1", () => {
    const cards = [
      card("p", 1, [...tens(10, 90), ...tens(9, 90), 51]),
      card("q", 2, [...tens(9, 90), 83, ...tens(9, 90), 44]),
    ]
    expect(periodRecords(cards, "decimal").smallestSeriesSpan[20]).toMatchObject({
      cardId: "p",
      value: 3.9,
    })
  })

  it("Kandidaten einer alten Projektion ohne die neuen Felder setzen nur die bisherigen Rekorde", () => {
    const full = cardRecordCandidates(card("a", 1, [...series(3), ...series(5)]), "decimal")
    expect(full).not.toBeNull()
    const {
      seriesTens: _seriesTens,
      seriesInnerTens: _seriesInnerTens,
      longestNineRun: _longestNineRun,
      weakestShot: _weakestShot,
      seriesSpan: _seriesSpan,
      ...old
    } = full as RecordCandidates
    const records = combineRecords([{ id: "a", atMs: DAY, candidates: old as RecordCandidates }])
    expect(records.bestCard[20]).toMatchObject({ cardId: "a" })
    expect(records.mostTensSeries).toEqual({})
    expect(records.mostInnerTensSeries).toEqual({})
    expect(records.longestNineRun).toBeNull()
    expect(records.bestWeakestShot).toEqual({})
    expect(records.smallestSeriesSpan).toEqual({})
  })
})
