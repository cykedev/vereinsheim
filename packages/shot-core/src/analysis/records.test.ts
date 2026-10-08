import { describe, expect, it } from "vitest"

import { card, DAY } from "../__fixtures__/period"
import { FLAG_SUSPICIOUS } from "../metrics"
import { periodRecords, recordEligible, RECORD_EXCLUDING_FLAGS } from "./records"

const tens = (count: number, tenths = 100) => Array<number>(count).fill(tenths)
/** Abstand zur Mitte je Schuss: der Teiler ist ein Zehntel davon */
const distances = (list: readonly number[]) => (i: number) => ({ distanceUm: list[i] })

describe("Was für Rekorde zählt (D7)", () => {
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
    expect(records.bestSeries).toEqual({ value: 40, cardId: "a", atMs: DAY, detail: "Serie 1" })
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

  it("eine Trainingsscheibe nur mit Probe zählt nur mit includeProbeOnly (D8)", () => {
    const cards = [
      card("a", 1, tens(20, 95), { shot: () => ({ distanceUm: 500 }) }),
      card("p", 2, [...tens(10, 95), ...tens(10, 100)], {
        probe: true,
        shot: (i) => ({ distanceUm: i === 12 ? 20 : 600 }),
      }),
    ]
    const without = periodRecords(cards, "decimal")
    expect(without.bestTeiler?.cardId).toBe("a")
    expect(without.bestSeries?.value).toBe(95)
    const withProbe = periodRecords(cards, "decimal", { includeProbeOnly: true })
    expect(withProbe.bestTeiler).toMatchObject({ cardId: "p", value: 2, detail: "Schuss 13" })
    expect(withProbe.bestSeries).toMatchObject({ cardId: "p", value: 100, detail: "Serie 2" })
  })
})
