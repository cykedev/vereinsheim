import { describe, expect, it } from "vitest"

import type { PeriodShape, PositionOverTime } from "@vereinsheim/shot-core/analysis"

import {
  axisWords,
  basisText,
  outlierWords,
  positionWords,
  shapeNote,
  shapeWords,
} from "./patternWords"

const shape = (verdict: PeriodShape["verdict"], angleRad = 0): PeriodShape => ({
  shots: 1240,
  cards: 31,
  sigmaUm: 1520,
  ratio: 1.28,
  angleRad,
  p: 0.001,
  verdict,
})

const overTime = (verdict: PositionOverTime["verdict"], x = 300, y = -265): PositionOverTime => ({
  points: [],
  mean: { xUm: x, yUm: y },
  offsetUm: Math.hypot(x, y),
  t2: 20,
  critical: 10,
  verdict,
})

describe("Worte zum Trefferbild", () => {
  it("Form: länglich mit Richtung, ohne Urteil, zu wenig", () => {
    expect(shapeWords(shape("elongated", 0.1)).lead).toBe(
      "Deine Gruppe ist länglich, eher waagrecht."
    )
    expect(shapeWords(shape("none")).lead).toBe("Deine Gruppe zieht in keine klare Richtung.")
    expect(shapeWords(shape("few"))).toEqual({
      lead: "Für ein Urteil über die Form fehlen noch Schüsse.",
      more: "Es braucht 100 Schuss aus 5 Scheiben.",
    })
    expect(shapeWords(null).lead).toBe("Für ein Urteil über die Form fehlen noch Schüsse.")
  })

  it("Richtung der langen Seite", () => {
    const deg = (d: number) => (d * Math.PI) / 180
    expect(axisWords(deg(0))).toBe("eher waagrecht")
    expect(axisWords(deg(170))).toBe("eher waagrecht")
    expect(axisWords(deg(90))).toBe("eher senkrecht")
    expect(axisWords(deg(45))).toBe("schräg nach rechts oben")
    expect(axisWords(deg(135))).toBe("schräg nach rechts unten")
  })

  it("Lage: versetzt mit Richtung und Abstand, passt, zu wenig", () => {
    expect(positionWords(overTime("offset")).lead).toBe(
      "Deine Lage ist versetzt: rechts tief, im Mittel 0,4 mm."
    )
    expect(positionWords(overTime("fits"))).toEqual({
      lead: "Deine Lage passt.",
      more: "Ein Versatz zeigt sich nicht.",
    })
    expect(positionWords(overTime("few"))).toEqual({
      lead: "Für ein Urteil über die Lage fehlen noch Scheiben.",
      more: "Es braucht 5 Scheiben mit Lage.",
    })
  })

  it("Ausreißer: Richtung, alle Richtungen, zu wenig", () => {
    const base = { n: 40, counts: new Array(12).fill(0), p: 0.01 }
    expect(outlierWords({ ...base, meanRad: 1.25 * Math.PI, verdict: "directed" }).lead).toBe(
      "Deine Ausreißer gehen meist nach links unten."
    )
    expect(outlierWords({ ...base, meanRad: 0, verdict: "none" }).lead).toBe(
      "Deine Ausreißer gehen in alle Richtungen."
    )
    expect(outlierWords(null).lead).toBe("Unter 30 Ausreißern ist die Uhr ein Bild, kein Befund.")
  })

  it("Grundlage mit und ohne Scheiben ohne Lage", () => {
    expect(basisText({ shots: 1240, cards: 38, cardsWithoutPosition: 7 })).toBe(
      "Über 1.240 Schuss aus 31 Scheiben, 7 ohne Lage."
    )
    expect(basisText({ shots: 40, cards: 1, cardsWithoutPosition: 0 })).toBe(
      "Über 40 Schuss aus 1 Scheibe."
    )
    expect(shapeNote({ shots: 1240, cards: 31 })).toBe(
      "Gerechnet über 1.240 Schuss aus 31 Scheiben, jede um ihre eigene Mitte."
    )
  })
})
