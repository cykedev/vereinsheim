import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { describe, expect, it } from "vitest"

import { listOnEvening } from "../nav/navigate"
import { DEFAULT_LIST, type ListQuery } from "../nav/routes"
import { NOW, periodCard, projected, TZ } from "../period/testSeason"
import {
  cardListModel,
  eveningDay,
  eveningsByMonth,
  lastEvening,
  type ListInputCard,
} from "./evenings"

const at = (hourUtc: number, minute = 0, day = 29) => Date.UTC(2026, 8, day, hourUtc, minute)
const lg = (card: PeriodCard): ListInputCard => ({ card: projected(card), family: "lg-freihand" })
const lp = (card: PeriodCard): ListInputCard => ({ card: projected(card), family: "lp-freihand" })
const context = { timeZone: TZ, nowMs: NOW, named: [], scoring: "decimal" as const }
const query = (patch: Partial<ListQuery> = {}): ListQuery => ({
  ...DEFAULT_LIST,
  family: "lg-freihand",
  ...patch,
})

// Dienstag, 29. September 2026 (MESZ = UTC+2): zwei Scheiben am Tag, eine Luftpistole am Abend, zwei nach
// Mitternacht vor 4 Uhr; Mittwoch 04:30 ist schon der nächste Abend; Sonntag nur Luftpistole
const INPUT: ListInputCard[] = [
  lg(periodCard("a", 1, [100, 102, 98], { startedAtMs: at(10) })),
  lg(periodCard("b", 1, [101, 103], { startedAtMs: at(17) })),
  lp(periodCard("c", 1, [95, 97], { startedAtMs: at(18) })),
  lg(periodCard("d", 1, [104], { startedAtMs: at(22, 30) })),
  lg(periodCard("e", 1, [99], { startedAtMs: at(1, 30, 30) })),
  lg(periodCard("f", 0, [102], { startedAtMs: at(2, 30, 30) })),
  lp(periodCard("g", 3, [96], { startedAtMs: at(16, 0, 27) })),
]

describe("Abende der Scheiben-Liste (Plan N2, D1–D5)", () => {
  it("ein Abend ist der Tag in der Anzeige-Zeitzone; vor 4 Uhr zählt zum Vortag", () => {
    expect(eveningDay(at(22, 30), TZ)).toBe("2026-09-29") // 00:30 MESZ
    expect(eveningDay(at(1, 30, 30), TZ)).toBe("2026-09-29") // 03:30 MESZ
    expect(eveningDay(at(2, 30, 30), TZ)).toBe("2026-09-30") // 04:30 MESZ
    expect(eveningDay(at(10), TZ)).toBe("2026-09-29")
  })

  it("Abende neueste zuerst, die Scheiben eines Abends in zeitlicher Folge, nur die Familie", () => {
    const model = cardListModel(INPUT, query(), context)
    expect(model.evenings.map((e) => e.day)).toEqual(["2026-09-30", "2026-09-29"])
    expect(model.evenings[1].rows.map((r) => r.id)).toEqual(["a", "b", "d", "e"])
    expect(model.evenings[0].rows.map((r) => r.id)).toEqual(["f"])
    expect(model.cards).toBe(5)
    expect(model.evenings[1].shots).toBe(3 + 2 + 1 + 1)
  })

  it("Mischabend: andere Familien des Abends mit Zahl; ein Abend nur der anderen Familie fehlt", () => {
    const model = cardListModel(INPUT, query(), context)
    expect(model.evenings[1].others).toEqual([{ family: "lp-freihand", count: 1 }])
    expect(model.evenings[0].others).toEqual([])
    const pistol = cardListModel(INPUT, query({ family: "lp-freihand" }), context)
    expect(pistol.evenings.map((e) => e.day)).toEqual(["2026-09-29", "2026-09-27"])
    expect(pistol.evenings[0].others).toEqual([{ family: "lg-freihand", count: 4 }])
  })

  it("Ergebnis und Ø in der Wertung; nur Probe rechnet wie Wertung", () => {
    const row = cardListModel(INPUT, query(), context).evenings[1].rows[0]
    expect(row.result).toBeCloseTo(30.0, 9)
    expect(row.mean).toBeCloseTo(10.0, 9)
    expect(row.shots).toBe(3)
    expect(row.kind).toBe("training")
    const rings = cardListModel(INPUT, query(), { ...context, scoring: "rings" })
    expect(rings.evenings[1].rows[0].result).toBe(29)
    // der Ø folgt der Wertung der Liste: 10 + 10 + 9 ganze Ringe sind 9,67 je Schuss, nicht 10,0
    expect(rings.evenings[1].rows[0].mean).toBeCloseTo(29 / 3, 9)
    const probe = cardListModel(
      [lg(periodCard("p", 1, [100, 104], { startedAtMs: at(10), probe: true }))],
      query(),
      context
    ).evenings[0].rows[0]
    expect(probe.kind).toBe("probe")
    expect(probe.result).toBeCloseTo(20.4, 9)
    expect(probe.shots).toBe(2)
  })

  it("Abstand zum Schnitt der bis zu fünf Scheiben davor, auch vor dem Zeitraum", () => {
    // sieben Scheiben an sieben Tagen, Ø je Schuss 10,0 · 10,2 · 9,8 · 10,1 · 10,0 · 10,3 · 9,9
    const days = [100, 102, 98, 101, 100, 103, 99].map((t, i) =>
      lg(periodCard(`k${i + 1}`, 7 - i, [t]))
    )
    const model = cardListModel(days, query(), context)
    const row = (id: string) => model.evenings.flatMap((e) => e.rows).find((r) => r.id === id)!
    expect(row("k1").delta).toBeNull()
    expect(row("k7").delta?.n).toBe(5)
    expect(row("k7").delta?.delta).toBeCloseTo(-0.18, 9)
    // nur drei Tage gezeigt, der Abstand rechnet trotzdem über die Scheiben davor
    const recent = cardListModel(
      days,
      query({ range: { type: "free", from: "2026-09-27", to: "2026-09-29" } }),
      context
    )
    expect(recent.evenings.flatMap((e) => e.rows).map((r) => r.id)).toEqual(["k7", "k6", "k5"])
    expect(recent.evenings[0].rows[0].delta?.delta).toBeCloseTo(-0.18, 9)
  })

  it("Art und Merkmal filtern; die Merkmale der Familie stehen dabei", () => {
    const cards = [
      lg(periodCard("t", 2, [100], { kind: "training" })),
      lg(periodCard("w", 1, [101], { kind: "competition", flags: ["nur-pdf"] })),
    ]
    expect(
      cardListModel(cards, query({ kind: "competition" }), context).evenings.flatMap((e) =>
        e.rows.map((r) => r.id)
      )
    ).toEqual(["w"])
    expect(
      cardListModel(cards, query({ flag: "nur-pdf" }), context).evenings.flatMap((e) =>
        e.rows.map((r) => r.id)
      )
    ).toEqual(["w"])
    expect(cardListModel(cards, query(), context).flags).toEqual(["nur-pdf"])
  })

  it("ohne Familie die erste vorhandene; ohne Scheiben keine Abende", () => {
    expect(cardListModel(INPUT, { ...DEFAULT_LIST }, context).family).toBe("lg-freihand")
    expect(cardListModel([], query(), context).evenings).toEqual([])
  })
})

describe("der letzte Abend (Plan N5, Start und Blättern von Start)", () => {
  it("der Abend der neuesten Scheibe, alle Familien, in zeitlicher Folge; vor 4 Uhr zählt zum Vortag", () => {
    expect(lastEvening(INPUT, TZ)).toEqual({
      day: "2026-09-30",
      cards: [INPUT[5]],
    })
    const evening = lastEvening(INPUT.slice(0, 5), TZ)
    expect(evening?.day).toBe("2026-09-29")
    expect(evening?.cards.map((c) => c.card.id)).toEqual(["a", "b", "c", "d", "e"])
    expect(lastEvening([], TZ)).toBeNull()
  })
})

describe("Scheiben-Liste nach dem Review (N2)", () => {
  it("an den Tagen der Zeitumstellung zählt die Uhrzeit der Zone, nicht vier Stunden absolut", () => {
    // 29. März 2026: 02:00 MEZ → 03:00 MESZ; 25. Oktober 2026: 03:00 MESZ → 02:00 MEZ
    expect(eveningDay(Date.UTC(2026, 2, 29, 2, 30), TZ)).toBe("2026-03-29") // 04:30 MESZ
    expect(eveningDay(Date.UTC(2026, 2, 29, 1, 30), TZ)).toBe("2026-03-28") // 03:30 MESZ
    expect(eveningDay(Date.UTC(2026, 9, 25, 2, 30), TZ)).toBe("2026-10-24") // 03:30 MEZ
    expect(eveningDay(Date.UTC(2026, 9, 25, 3, 30), TZ)).toBe("2026-10-25") // 04:30 MEZ
    expect(eveningDay(Date.UTC(2026, 9, 24, 22, 30), TZ)).toBe("2026-10-24") // 00:30 MESZ
  })

  it("ein Merkmal, das die Familie nicht hat, bleibt wählbar, damit man es wieder lösen kann", () => {
    const model = cardListModel(INPUT, query({ family: "lp-freihand", flag: "nur-pdf" }), context)
    expect(model.cards).toBe(0)
    expect(model.flags).toEqual(["nur-pdf"])
  })

  it("Abstand über Familie und Art, Trainings nur aus Probe gehören dazu", () => {
    // Ø je Schuss: t1 10,0 · w1 9,0 · t2 10,2 · p1 9,6 (nur Probe) · w2 9,2 · t3 10,1
    const cards = [
      lg(periodCard("t1", 8, [100])),
      lg(periodCard("w1", 7, [90], { kind: "competition" })),
      lg(periodCard("t2", 6, [102])),
      lg(periodCard("p1", 5, [96], { probe: true })),
      lg(periodCard("w2", 4, [92], { kind: "competition" })),
      lg(periodCard("t3", 3, [101])),
    ]
    const model = cardListModel(cards, query({ kind: "training" }), context)
    const t3 = model.evenings.flatMap((e) => e.rows).find((r) => r.id === "t3")!
    // vor t3 im Training: t1, t2, p1 → 10,1 − 29,8 / 3; ohne Art (alle fünf) wäre es +0,50, ohne Probe 0
    expect(t3.delta?.n).toBe(3)
    expect(t3.delta?.delta).toBeCloseTo(0.5 / 3, 9)
  })

  it("andere Familien zählen ohne Art und Merkmal, aber nur im Zeitraum; der Sprung zeigt den Abend", () => {
    // Samstag, 26. September: Wettkampf Luftgewehr, Training Luftpistole (nur PDF), eine Luftpistole um 03:00 MESZ
    const cards = [
      lg(periodCard("lw", 4, [100], { kind: "competition", startedAtMs: at(16, 0, 26) })),
      lp(periodCard("pt", 4, [95], { startedAtMs: at(18, 0, 26), flags: ["nur-pdf"] })),
      lp(periodCard("pn", 3, [96], { startedAtMs: at(1, 0, 27) })),
    ]
    const competition = query({ kind: "competition", flag: null })
    const rifle = cardListModel(cards, competition, context)
    expect(rifle.evenings[0].others).toEqual([{ family: "lp-freihand", count: 2 }])
    // im Zeitraum bis 26. September fällt die Scheibe nach Mitternacht heraus wie in der Liste selbst
    const ranged = cardListModel(
      cards,
      { ...competition, range: { type: "free", from: "2026-09-20", to: "2026-09-26" } },
      context
    )
    expect(ranged.evenings[0].others).toEqual([{ family: "lp-freihand", count: 1 }])
    // der Sprung lässt Art und Merkmal fallen: der Abend steht in der Liste der Luftpistole
    const jump = listOnEvening(competition, "lp-freihand", "2026-09-26")
    expect(jump.evening).toBe("2026-09-26")
    const pistol = cardListModel(cards, jump.query, context)
    expect(pistol.evenings.find((e) => e.day === "2026-09-26")?.rows.map((r) => r.id)).toEqual([
      "pt",
      "pn",
    ])
  })

  it("Monate aus den Abenden, neueste zuerst, mit Zahl der Scheiben und Schüsse", () => {
    const cards = [
      lg(periodCard("s1", 2, [100, 101])),
      lg(periodCard("s2", 1, [100])),
      lg(periodCard("a1", 40, [99, 98, 97])),
    ]
    const months = eveningsByMonth(cardListModel(cards, query(), context).evenings)
    expect(months.map((m) => [m.month, m.evenings.map((e) => e.day), m.cards, m.shots])).toEqual([
      ["2026-09", ["2026-09-29", "2026-09-28"], 2, 3],
      ["2026-08", ["2026-08-21"], 1, 3],
    ])
    expect(eveningsByMonth([])).toEqual([])
  })

  it("gleiche Startzeit: nach Id, unabhängig von der Reihenfolge der Eingabe", () => {
    const same = at(16)
    const model = cardListModel(
      [
        lg(periodCard("b2", 1, [100], { startedAtMs: same })),
        lg(periodCard("a2", 1, [101], { startedAtMs: same })),
      ],
      query(),
      context
    )
    expect(model.evenings[0].rows.map((r) => r.id)).toEqual(["a2", "b2"])
  })

  it("Stellen aus den Kennzahlen: Ergebnis je Wertung, Ø in der Wertung der Liste", () => {
    const decimal = cardListModel(INPUT, query(), context)
    expect(decimal.digits).toEqual({ result: { decimal: 1, rings: 0 }, mean: 2 })
    expect(decimal.scoring).toBe("decimal")
    expect(cardListModel(INPUT, query(), { ...context, scoring: "rings" }).scoring).toBe("rings")
  })

  it("beide Ergebnisse: ohne Wertung der Scheibe vorn die amtliche, ohne sie die der Liste", () => {
    // 100 + 102 + 98: 30,0 in Zehnteln, 10 + 10 + 9 = 29 in ganzen Ringen
    const cards = [
      lg(periodCard("r", 3, [100, 102, 98], { official: "rings" })),
      lg(periodCard("z", 2, [100, 102, 98], { official: "decimal" })),
      lg(periodCard("u", 1, [100, 102, 98])),
      lg(periodCard("p", 0, [100, 102, 98], { probe: true, official: "rings" })),
    ]
    const rows = (scoring: "decimal" | "rings") =>
      cardListModel(cards, query(), { ...context, scoring }).evenings.flatMap((e) => e.rows)
    const byId = (scoring: "decimal" | "rings", id: string) =>
      rows(scoring).find((r) => r.id === id)!
    // amtlich ganze Ringe: 29 vorn, auch wenn die Liste Zehntel zeigt; der Ø bleibt in der Wertung der Liste
    expect(byId("decimal", "r")).toMatchObject({
      result: 29,
      resultScoring: "rings",
      ofCard: true,
      mean: 10,
    })
    expect(byId("decimal", "r").otherResult).toBeCloseTo(30.0, 9)
    // amtlich Zehntel: 30,0 vorn, auch wenn die Liste ganze Ringe zeigt
    expect(byId("rings", "z")).toMatchObject({
      resultScoring: "decimal",
      ofCard: true,
      otherResult: 29,
    })
    expect(byId("rings", "z").result).toBeCloseTo(30.0, 9)
    // unbekannt: die Wertung der Liste vorn
    expect(byId("rings", "u")).toMatchObject({
      result: 29,
      resultScoring: "rings",
      ofCard: false,
    })
    expect(byId("decimal", "u")).toMatchObject({ resultScoring: "decimal", otherResult: 29 })
    // nur Probe ist nie amtlich, auch wenn die Quelle eine Wertung nennt
    expect(byId("decimal", "p")).toMatchObject({ resultScoring: "decimal", ofCard: false })
  })

  it("vorn die Wertung der Scheibe, vor der amtlichen, auch bei nur Probe; Ø und Abstand in der Wertung der Liste", () => {
    const withScoring = (card: PeriodCard, scoring: "decimal" | "rings"): ListInputCard => ({
      card: { ...projected(card), scoring },
      family: "lg-freihand",
    })
    const cards = [
      withScoring(periodCard("w", 3, [100, 102, 98], { official: "rings" }), "decimal"),
      withScoring(periodCard("t", 2, [100, 102, 98]), "rings"),
      withScoring(periodCard("p", 0, [100, 102, 98], { probe: true }), "rings"),
    ]
    const rows = (scoring: "decimal" | "rings") =>
      cardListModel(cards, query(), { ...context, scoring }).evenings.flatMap((e) => e.rows)
    const byId = (scoring: "decimal" | "rings", id: string) =>
      rows(scoring).find((r) => r.id === id)!
    // auf Zehntel gestellt, obwohl amtlich ganze Ringe: 30,0 vorn; der Ø in der Wertung der Liste
    expect(byId("rings", "w")).toMatchObject({ resultScoring: "decimal", ofCard: true })
    expect(byId("rings", "w").result).toBeCloseTo(30.0, 9)
    expect(byId("rings", "w").mean).toBeCloseTo(29 / 3, 9)
    expect(byId("rings", "w").otherResult).toBe(29)
    expect(byId("decimal", "t")).toMatchObject({ result: 29, resultScoring: "rings", ofCard: true })
    expect(byId("decimal", "t").mean).toBeCloseTo(10, 9)
    expect(byId("decimal", "p")).toMatchObject({ result: 29, resultScoring: "rings", ofCard: true })
  })
})
