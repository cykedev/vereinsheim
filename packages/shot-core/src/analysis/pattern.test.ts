import { describe, expect, it } from "vitest"

import { normalPoints } from "../__fixtures__/random"
import type { Point } from "../geometry"
import { periodShape, type PatternCard } from "./pattern"

const card = (id: string, points: readonly Point[], atMs = 0): PatternCard => ({ id, atMs, points })

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
