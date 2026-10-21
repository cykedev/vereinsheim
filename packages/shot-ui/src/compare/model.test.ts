import type { PatternCard, PeriodCard } from "@vereinsheim/shot-core/analysis"
import { describe, expect, it } from "vitest"

import { item, marksOf, periodCard } from "../period/testSeason"
import { cardCompareModel, groupCompareModel } from "./model"
import { KIND_NAMES } from "./words"

/** `n` Scheiben zu 10 Schuss mit gleichem Wert, Lagen nebeneinander */
const cardsOf = (prefix: string, n: number, tenths: number, firstDay = 0) =>
  Array.from({ length: n }, (_, i) =>
    periodCard(`${prefix}${i}`, firstDay + i, [tenths, tenths - 1, tenths + 1, tenths, tenths], {
      spreadUm: 200 + 10 * i,
    })
  )

const positionsOf = (cards: readonly PeriodCard[]): PatternCard[] => {
  const marks = marksOf(cards)
  return cards.map((card) => ({
    id: card.id,
    atMs: card.startedAtMs,
    points: marks.get(card.id) ?? [],
  }))
}

const group = (a: readonly PeriodCard[], b: readonly PeriodCard[], extra = {}) =>
  groupCompareModel({
    type: "kind",
    a: a.map(item),
    b: b.map(item),
    positions: positionsOf([...a, ...b]),
    scoring: "decimal",
    includeProbeOnly: true,
    names: KIND_NAMES,
    shared: 0,
    ...extra,
  })

describe("groupCompareModel", () => {
  const strong = cardsOf("a", 6, 104)
  const weak = cardsOf("b", 6, 90, 10)

  it("A höher: Δ = A − B, Einheit die Scheibe, Seiten gezählt", () => {
    const model = group(strong, weak)
    expect(model.unit).toBe("card")
    expect(model.result.comparison?.verdict).toBe("higher")
    expect(model.result.comparison?.delta).toBeCloseTo(1.4, 9)
    expect(model.result.a).toBeCloseTo(10.4, 9)
    expect(model.result.b).toBeCloseTo(9, 9)
    expect(model.a).toMatchObject({ name: "Wettkampf", cards: 6, shots: 30, withoutPosition: 0 })
    expect(model.metrics.map((row) => row.key)).toContain("group.sigma")
  })

  it("Gegenprobe: A und B getauscht, dann kippt das Vorzeichen", () => {
    const model = group(weak, strong)
    expect(model.result.comparison?.verdict).toBe("lower")
    expect(model.result.comparison?.delta).toBeCloseTo(-1.4, 9)
  })

  it("unter fünf Scheiben je Seite: kein Test", () => {
    expect(group(strong.slice(0, 4), weak).result.comparison?.test).toBeNull()
  })

  it("ein Training nur aus Probe zählt nur mit dem Schalter", () => {
    const probe = periodCard("p", 3, [100, 100, 100], { probe: true })
    expect(group([...strong, probe], weak).a.cards).toBe(7)
    expect(group([...strong, probe], weak, { includeProbeOnly: false }).a.cards).toBe(6)
  })

  it("eine Scheibe ohne Lagen zählt im Ergebnis, nicht im Bild", () => {
    const model = groupCompareModel({
      type: "periods",
      a: strong.map(item),
      b: weak.map(item),
      // die erste mit gelesenen, leeren Lagen; die zweite fehlt (über der Obergrenze nicht gelesen)
      positions: [
        { id: strong[0].id, atMs: strong[0].startedAtMs, points: [] },
        ...positionsOf([...strong.slice(2), ...weak]),
      ],
      scoring: "decimal",
      includeProbeOnly: true,
      names: KIND_NAMES,
      shared: 2,
    })
    expect(model.a.withoutPosition).toBe(1)
    expect(model.result.comparison?.a.n).toBe(6)
    // 4 Scheiben zu 5 Schuss mit Lage: unter 50 Schuss die Punkte
    expect(model.picture.style).toBe("dots")
    if (model.picture.a.kind === "dots") expect(model.picture.a.points).toHaveLength(20)
    expect(model.shared).toBe(2)
  })

  it("die Lage über die Mitten der Scheiben", () => {
    expect(group(strong, weak).position?.a.n).toBe(6)
  })
})

describe("cardCompareModel", () => {
  const a = periodCard(
    "a",
    1,
    Array.from({ length: 20 }, () => 104)
  )
  const b = periodCard(
    "b",
    2,
    Array.from({ length: 20 }, () => 90)
  )
  const model = cardCompareModel({
    a,
    b,
    scoring: "decimal",
    names: {
      a: { name: "A", at: "am 29.09.", short: "29.09." },
      b: { name: "B", at: "am 28.09.", short: "28.09." },
    },
  })

  it("Schuss für Schuss: Einheit der Schuss, die Werte der Scheiben", () => {
    expect(model.unit).toBe("shot")
    expect(model.result.a).toBeCloseTo(10.4, 9)
    expect(model.result.b).toBeCloseTo(9, 9)
    expect(model.result.comparison?.a.n).toBe(20)
    expect(model.result.comparison?.verdict).toBe("higher")
    expect(model.a).toMatchObject({ cards: 1, shots: 20, withoutPosition: 0 })
  })

  it("die übrigen Kennzahlen ohne Vergleich, das Bild mit Punkten", () => {
    expect(model.metrics.every((row) => row.comparison === null)).toBe(true)
    expect(model.picture.style).toBe("dots")
  })
})
