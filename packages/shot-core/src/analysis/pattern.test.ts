import { describe, expect, it } from "vitest"

import { normalPoints } from "../__fixtures__/random"
import {
  outlierDirection,
  PATTERN_DENSITY_FROM,
  PATTERN_SHOTS_MAX,
  periodPattern,
  periodShape,
  positionOverTime,
  positionPoints,
  type PatternCard,
  type PatternPoint,
} from "./pattern"

const card = (id: string, points: readonly PatternPoint[], atMs = 0): PatternCard => ({
  id,
  atMs,
  points,
})

/** `count` Scheiben zu je `shots` Schuss mit eigenem Seed */
const cardsOf = (count: number, shots: number, sigmaUm: number, sigmaYUm = sigmaUm, seed = 7) =>
  Array.from({ length: count }, (_, i) =>
    card(`c${i}`, normalPoints(shots, sigmaUm, seed + i, { sigmaYUm }), i)
  )

describe("periodShape (L9)", () => {
  it("Streuung nur waagrecht: Winkel 0 und sehr länglich", () => {
    const line = (y: number) => [-300, -100, 100, 300].map((x) => ({ xUm: x, yUm: y }))
    const shape = periodShape([card("a", [...line(0), { xUm: 0, yUm: 10 }]), card("b", line(0))])
    expect(shape).not.toBeNull()
    expect(shape?.angleRad).toBeCloseTo(0, 2)
    expect(shape?.ratio).toBeGreaterThan(10)
  })

  it("eine runde Gruppe aus 400 Schuss in 10 Scheiben: keine klare Richtung", () => {
    const shape = periodShape(cardsOf(10, 40, 1500))
    expect(shape?.verdict).toBe("none")
    expect(shape?.shots).toBe(400)
    expect(shape?.cards).toBe(10)
    expect(shape?.sigmaUm).toBeGreaterThan(1350)
    expect(shape?.sigmaUm).toBeLessThan(1650)
  })

  it("Länge zu Breite 1,5 über 400 Schuss: länglich, waagrecht", () => {
    const shape = periodShape(cardsOf(10, 40, 1500, 1000))
    expect(shape?.verdict).toBe("elongated")
    expect(shape?.ratio).toBeGreaterThan(1.3)
    const angle = shape?.angleRad ?? 1
    expect(Math.min(angle, Math.PI - angle)).toBeLessThan(0.2)
  })

  it("eine kleine Streckung unter 1,15 ist kein Befund, auch wenn der Test sie zeigt", () => {
    const shape = periodShape(cardsOf(40, 40, 1500, 1500 / 1.08))
    expect(shape?.p).toBeLessThan(0.05)
    expect(shape?.ratio).toBeLessThan(1.15)
    expect(shape?.verdict).toBe("none")
  })

  it("unter 100 Schuss oder 5 Scheiben kein Urteil", () => {
    expect(periodShape(cardsOf(8, 10, 1500, 500))?.verdict).toBe("few")
    expect(periodShape(cardsOf(4, 40, 1500, 500))?.verdict).toBe("few")
  })

  it("die Lage der Scheiben geht nicht ein", () => {
    const cards = cardsOf(6, 20, 1500)
    const moved = cards.map((c, i) =>
      i === 0
        ? card(
            c.id,
            c.points.map((p) => ({ xUm: p.xUm + 5000, yUm: p.yUm }))
          )
        : c
    )
    expect(periodShape(moved)?.sigmaUm).toBeCloseTo(periodShape(cards)?.sigmaUm ?? 0, 6)
  })

  it("Scheiben unter drei Punkten zählen nicht, ohne jede Scheibe null", () => {
    const two = card("x", [
      { xUm: 0, yUm: 0 },
      { xUm: 9000, yUm: 0 },
    ])
    expect(periodShape([two])).toBeNull()
    const cards = cardsOf(5, 20, 1500)
    expect(periodShape([...cards, two])?.shots).toBe(100)
  })
})

describe("positionPoints und positionOverTime (L10)", () => {
  /** Scheiben mit vier Punkten symmetrisch um ihre Mitte, damit die Mitte genau stimmt */
  const around = (id: string, x: number, y: number, atMs: number) =>
    card(
      id,
      [
        { xUm: x - 100, yUm: y },
        { xUm: x + 100, yUm: y },
        { xUm: x, yUm: y - 100 },
        { xUm: x, yUm: y + 100 },
      ],
      atMs
    )

  it("Schwerpunkte in zeitlicher Folge, Scheiben unter drei Punkten fehlen", () => {
    const points = positionPoints([
      around("b", 10, 20, 2),
      around("a", 30, 40, 1),
      card("c", [{ xUm: 0, yUm: 0 }], 3),
    ])
    expect(points.map((p) => p.id)).toEqual(["a", "b"])
    // Abweichungsquadrate um die Mitte: 2 · 100² je Richtung, ohne Kovarianz
    expect(points[0]).toEqual({
      id: "a",
      atMs: 1,
      center: { xUm: 30, yUm: 40 },
      n: 4,
      scatter: [20000, 20000, 0],
    })
  })

  it("fünf Scheiben um (400 | −300): versetzt", () => {
    const offsets = [
      [380, -310],
      [420, -290],
      [400, -320],
      [410, -280],
      [390, -300],
    ]
    const result = positionOverTime(
      positionPoints(offsets.map(([x, y], i) => around(`c${i}`, x, y, i)))
    )
    expect(result.verdict).toBe("offset")
    expect(result.mean?.xUm).toBeCloseTo(400, 6)
    expect(result.mean?.yUm).toBeCloseTo(-300, 6)
    expect(result.offsetUm).toBeCloseTo(500, 6)
  })

  it("fünf Scheiben symmetrisch um die Mitte: passt", () => {
    const offsets = [
      [300, 0],
      [-300, 0],
      [0, 300],
      [0, -300],
      [0, 0],
    ]
    const result = positionOverTime(
      positionPoints(offsets.map(([x, y], i) => around(`c${i}`, x, y, i)))
    )
    expect(result.verdict).toBe("fits")
    expect(result.offsetUm).toBeCloseTo(0, 6)
  })

  it("Mitte über alle Schüsse, Abende ohne Wandern: kurze tiefe Scheiben machen keinen Versatz zu Zufall", () => {
    // fünf Scheiben zu 40 Schuss hoch, zwei zu 10 tief, Streuung je Schuss gleich
    const ring = (x: number, y: number, r: number) => {
      const a = Math.round(r / Math.SQRT2)
      return [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
        [a, a],
        [-a, -a],
        [a, -a],
        [-a, a],
      ].map(([dx, dy]) => ({ xUm: x + dx, yUm: y + dy }))
    }
    const long = (id: string, x: number, y: number, at: number) =>
      card(id, Array.from({ length: 5 }, () => ring(x, y, 11000)).flat(), at)
    const short = (id: string, x: number, y: number, at: number) =>
      card(id, [...ring(x, y, 11000), { xUm: x, yUm: y }, { xUm: x, yUm: y }], at)
    const cards = [
      long("a", 100, 2600, 1),
      long("b", -200, 3000, 2),
      short("c", 300, -1700, 3),
      long("d", 150, 2200, 4),
      long("e", -50, 2800, 5),
      short("f", -300, 800, 6),
      long("g", 0, 2400, 7),
    ]
    const result = positionOverTime(positionPoints(cards))
    const all = cards.flatMap((c) => c.points)
    expect(result.mean?.yUm).toBeCloseTo(all.reduce((s, p) => s + p.yUm, 0) / all.length, 6)
    expect(result.mean?.yUm).toBeCloseTo(511000 / 220, 6)
    expect(result.wander).toBe(false)
    expect(result.verdict).toBe("offset")
    expect(result.p).toBeLessThan(0.001)
  })

  it("nur seitlich wandernde Abende: In der Höhe zählt weiter jeder Schuss", () => {
    // wie oben, aber die Mitten liegen seitlich weit auseinander (bis 12 mm), in der Höhe ohne Wandern
    const ring = (x: number, y: number) => {
      const r = 11000
      const a = Math.round(r / Math.SQRT2)
      return [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
        [a, a],
        [-a, -a],
        [a, -a],
        [-a, a],
      ].map(([dx, dy]) => ({ xUm: x + dx, yUm: y + dy }))
    }
    const long = (id: string, x: number, y: number, at: number) =>
      card(id, Array.from({ length: 5 }, () => ring(x, y)).flat(), at)
    const short = (id: string, x: number, y: number, at: number) =>
      card(id, [...ring(x, y), { xUm: x, yUm: y }, { xUm: x, yUm: y }], at)
    const cards = [
      long("a", 6000, 2600, 1),
      long("b", -9000, 3000, 2),
      short("c", 12000, -1700, 3),
      long("d", -4000, 2200, 4),
      long("e", 8000, 2800, 5),
      short("f", -12000, 800, 6),
      long("g", -3000, 2400, 7),
    ]
    const result = positionOverTime(positionPoints(cards))
    expect(result.wanderAxes).toEqual({ x: true, y: false })
    expect(result.wander).toBe(true)
    expect(result.verdict).toBe("offset")
    // der Bereich der Mitte schließt die Mitte der Scheibe in der Höhe aus, seitlich nicht
    expect(result.region).not.toBeNull()
    expect(Math.abs(result.mean!.yUm)).toBeGreaterThan(result.region!.yUm)
    expect(Math.abs(result.mean!.xUm)).toBeLessThan(result.region!.xUm)
  })

  it("vier Scheiben: kein Urteil", () => {
    const result = positionOverTime(
      positionPoints([0, 1, 2, 3].map((i) => around(`c${i}`, 400 + i * 10, -300 - i * 7, i)))
    )
    expect(result.verdict).toBe("few")
    expect(result.region).toBeNull()
  })
})

describe("outlierDirection (L7)", () => {
  /** neun Punkte eng auf einem Kreis und ein weiter in Richtung `clockRad` (von oben im Uhrzeigersinn) */
  const withFlier = (id: string, clockRad: number, at = { xUm: 0, yUm: 0 }) =>
    card(id, [
      ...Array.from({ length: 9 }, (_, i) => ({
        xUm: at.xUm + Math.round(100 * Math.sin((i * 2 * Math.PI) / 9)),
        yUm: at.yUm + Math.round(100 * Math.cos((i * 2 * Math.PI) / 9)),
      })),
      {
        xUm: at.xUm + Math.round(1500 * Math.sin(clockRad)),
        yUm: at.yUm + Math.round(1500 * Math.cos(clockRad)),
      },
    ])

  it("Ausreißer immer links unten: Vorzugsrichtung um halb acht", () => {
    const result = outlierDirection(
      Array.from({ length: 30 }, (_, i) => withFlier(`c${i}`, 1.25 * Math.PI))
    )
    expect(result?.n).toBe(30)
    expect(result?.verdict).toBe("directed")
    expect(result?.meanRad).toBeCloseTo(1.25 * Math.PI, 1)
    expect((result?.counts[7] ?? 0) + (result?.counts[8] ?? 0)).toBe(30)
  })

  it("gemessen von der Mitte der Gruppe, nicht von der Mitte der Zielscheibe", () => {
    const result = outlierDirection(
      Array.from({ length: 30 }, (_, i) =>
        withFlier(`c${i}`, 0.5 * Math.PI, { xUm: -4000, yUm: 0 })
      )
    )
    expect(result?.meanRad).toBeCloseTo(0.5 * Math.PI, 1)
  })

  it("Ausreißer gleichmäßig in alle Richtungen: keine Vorzugsrichtung", () => {
    const result = outlierDirection(
      Array.from({ length: 36 }, (_, i) => withFlier(`c${i}`, (i * Math.PI) / 6))
    )
    expect(result?.verdict).toBe("none")
    expect(result?.counts).toEqual(new Array(12).fill(3))
  })

  it("unter 30 Ausreißern kein Urteil, Scheiben unter zehn Punkten zählen nicht", () => {
    expect(
      outlierDirection(Array.from({ length: 29 }, (_, i) => withFlier(`c${i}`, Math.PI)))?.verdict
    ).toBe("few")
    const nine = card("n", withFlier("n", 0).points.slice(0, 9))
    expect(outlierDirection([nine])).toBeNull()
  })
})

describe("periodPattern", () => {
  it("unter 50 Schuss jeder Treffer mit Ring", () => {
    const few = periodPattern([
      card("a", [
        { xUm: 1000, yUm: 0, ring: 9 },
        { xUm: -1000, yUm: 0, ring: null },
        { xUm: 0, yUm: 500 },
      ]),
    ])
    expect(few.picture.style).toBe("rings")
    expect(few.picture.points).toEqual([
      [100, 0, 9, null],
      [-100, 0, null, null],
      [0, 50, null, null],
    ])
    expect(few.picture.grid).toBeNull()
    expect(few.picture.center).toEqual({ xUm: 0, yUm: 167 })
    // jeder Punkt liegt im Bild, mit Rand für das Kaliber
    expect(few.picture.halfUm).toBe(1000 * 1.15 + 500)
    expect(PATTERN_DENSITY_FROM).toBe(50)
  })

  it("ab 50 Schuss jeder Treffer mit seinem Band der Dichte, die dichten zuletzt", () => {
    const flier = { xUm: 9000, yUm: 0, ring: 7 }
    const pattern = periodPattern([...cardsOf(10, 40, 1500), card("weit", [flier])])
    expect(pattern.picture.style).toBe("shots")
    // das Raster kommt mit: aus ihm zeichnet das Bild die Umrisse statt der Treffer
    expect(pattern.picture.grid?.cells).toHaveLength(64 * 64)
    expect(pattern.picture.grid?.levels).toHaveLength(6)
    const points = pattern.picture.points!
    expect(points).toHaveLength(401)
    const bands = points.map((p) => p[3] as number)
    expect(bands).toEqual([...bands].sort((a, b) => a - b))
    expect(Math.min(...bands)).toBe(0)
    expect(Math.max(...bands)).toBe(5)
    // der Abreißer ist selten; liegt er weiter draußen als das 1,6-Fache von 99 % der Schüsse, wird er gezählt
    expect(points.find((p) => p[0] === 900)?.[3]).toBe(0)
    expect(pattern.picture.outside).toBe(pattern.picture.halfUm < 9000 ? 1 : 0)
    // die meisten liegen im Kern: das innerste Band hat etwa ein Zehntel
    const inner = bands.filter((b) => b === 5).length / bands.length
    expect(inner).toBeGreaterThan(0.04)
    expect(inner).toBeLessThan(0.2)
  })

  it("über 3.000 Schuss nur das Raster für die Umrisse, wie beim Vergleichen", () => {
    const pattern = periodPattern(cardsOf(80, 40, 1500))
    expect(pattern.picture.style).toBe("outlines")
    expect(pattern.picture.points).toBeNull()
    expect(pattern.picture.grid?.levels).toHaveLength(6)
    expect(PATTERN_SHOTS_MAX).toBe(3000)
  })

  it("zählt Scheiben ohne Lage, Schwerpunkte nur ab drei Punkten", () => {
    const pattern = periodPattern([
      ...cardsOf(5, 20, 1500),
      card("leer", []),
      card("zwei", [
        { xUm: 0, yUm: 0 },
        { xUm: 100, yUm: 0 },
      ]),
    ])
    expect(pattern.cards).toBe(7)
    expect(pattern.cardsWithoutPosition).toBe(1)
    expect(pattern.shots).toBe(102)
    expect(pattern.overTime.points).toHaveLength(5)
  })

  it("ohne Trefferlage als Summe: die Mitte aller Punkte wie bisher", () => {
    const pattern = periodPattern([
      card("a", [
        { xUm: 1000, yUm: 0 },
        { xUm: -1000, yUm: 0 },
        { xUm: 0, yUm: 500 },
      ]),
      card("b", [
        { xUm: 0, yUm: -200 },
        { xUm: 300, yUm: 0 },
      ]),
    ])
    expect(pattern.picture.center).toEqual({ xUm: 60, yUm: 60 })
    expect(pattern.summaryCards).toBe(0)
  })

  it("eine Trefferlage als Summe zählt gewichtet in der Mitte, nicht in Form und Lage über Zeit", () => {
    const around = card(
      "punkte",
      [500, -500, 300, -300, 100, -100, 700, -700, 900, -900].map((xUm, i) => ({
        xUm,
        yUm: i % 2 ? -200 : 200,
      }))
    )
    const alone = periodPattern([around])
    const pattern = periodPattern([
      around,
      card("summe", [], 1),
      { ...card("lage", [], 2), summaryCenter: { xUm: 3000, yUm: 0, n: 30 } },
    ])
    expect(pattern.picture.center).toEqual({ xUm: 2250, yUm: 0 })
    expect(pattern.summaryCards).toBe(1)
    expect(pattern.cardsWithoutPosition).toBe(2)
    expect(pattern.shots).toBe(10)
    expect(pattern.overTime).toEqual(alone.overTime)
    expect(pattern.shape).toEqual(alone.shape)
    expect(pattern.outliers).toEqual(alone.outliers)
  })

  it("nur Trefferlagen als Summe: die gewichtete Mitte, das Bild reicht bis zu ihr", () => {
    const pattern = periodPattern([
      { ...card("a", []), summaryCenter: { xUm: 4000, yUm: 0, n: 10 } },
      { ...card("b", [], 1), summaryCenter: { xUm: 0, yUm: 800, n: 30 } },
    ])
    expect(pattern.shots).toBe(0)
    expect(pattern.summaryCards).toBe(2)
    expect(pattern.picture.center).toEqual({ xUm: 1000, yUm: 600 })
    expect(pattern.picture.halfUm).toBeGreaterThanOrEqual(Math.hypot(1000, 600))
    expect(pattern.picture.points).toEqual([])
  })

  it("ab 50 Schuss und über 3.000 Schuss reicht das Bild bis zur Mitte aus Trefferlagen als Summe", () => {
    for (const cards of [cardsOf(2, 40, 1500), cardsOf(80, 40, 1500)]) {
      const pattern = periodPattern([
        ...cards,
        {
          ...card("lage", [], 999),
          summaryCenter: { xUm: 60_000, yUm: 0, n: 40 * cards.length * 3 },
        },
      ])
      const middle = pattern.picture.center!
      expect(pattern.picture.halfUm).toBeGreaterThanOrEqual(Math.hypot(middle.xUm, middle.yUm))
    }
    // ohne Trefferlage als Summe bleibt der Ausschnitt, wie er war
    expect(periodPattern(cardsOf(2, 40, 1500)).picture.halfUm).toBeLessThan(10_000)
  })

  it("geht unverändert durch JSON", () => {
    const pattern = periodPattern(cardsOf(10, 40, 1500, 1200))
    expect(JSON.parse(JSON.stringify(pattern))).toEqual(pattern)
  })

  it("150.000 Schuss: ohne Stapelüberlauf, als Umrisse", () => {
    const pattern = periodPattern(cardsOf(3750, 40, 1500))
    expect(pattern.picture.style).toBe("outlines")
    expect(pattern.shots).toBe(150_000)
  })

  it("1.500 Scheiben zu 40 Schuss: unter 200 KB und schnell", () => {
    const cards = cardsOf(1500, 40, 1500).map((c, i) => ({
      ...c,
      id: `cmh${String(i).padStart(22, "0")}`,
      atMs: 1_700_000_000_000 + i * 86_400_000,
    }))
    const started = performance.now()
    const pattern = periodPattern(cards)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(JSON.stringify(pattern).length).toBeLessThan(200_000)
  })
})
