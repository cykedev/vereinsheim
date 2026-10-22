import { describe, expect, it } from "vitest"

import type { PeriodShape, PositionOverTime } from "@vereinsheim/shot-core/analysis"

import { emptyPeriodText } from "./sentence"

import {
  axisWords,
  basisText,
  outlierWords,
  outsideText,
  pictureWords,
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
  points: Array.from({ length: 7 }, (_, i) => ({
    id: `c${i}`,
    atMs: i,
    center: { xUm: x, yUm: y },
    n: 40,
  })),
  mean: { xUm: x, yUm: y },
  offsetUm: Math.hypot(x, y),
  p: verdict === "offset" ? 0.01 : 0.4,
  wander: false,
  wanderAxes: { x: false, y: false },
  region: verdict === "few" ? null : { xUm: 500, yUm: 500 },
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

  it("Lage: versetzt mit Richtung und Abstand; ohne Urteil sagt der Satz, was das Bild zeigt; zu wenig", () => {
    expect(positionWords(overTime("offset")).lead).toBe(
      "Deine Lage ist versetzt: rechts tief, im Mittel 0,4 mm."
    )
    // nie „passt“ neben einem Kreis, der daneben liegt: die Lage in Zahlen, dann wie sicher sie ist
    expect(positionWords(overTime("fits"))).toEqual({
      lead: "Deine Mitte liegt 0,4 mm rechts tief.",
      more: "Ob das so bleibt, ist mit 7 Scheiben noch nicht sicher.",
    })
    expect(positionWords(overTime("fits", 20, -10)).lead).toBe("Deine Mitte liegt in der Mitte.")
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

  it("unter dem Trefferbild erst die Lage, dann die Form", () => {
    expect(pictureWords({ overTime: overTime("offset"), shape: shape("elongated", 0.8) })).toEqual({
      lead: "Deine Lage ist versetzt: rechts tief, im Mittel 0,4 mm.",
      more: "Die Gruppe ist länglich, schräg nach rechts oben.",
    })
    expect(pictureWords({ overTime: overTime("fits"), shape: shape("none") })).toEqual({
      lead: "Deine Mitte liegt 0,4 mm rechts tief.",
      more: "Ob das so bleibt, ist mit 7 Scheiben noch nicht sicher. Die Gruppe zieht in keine klare Richtung.",
    })
    expect(pictureWords({ overTime: overTime("fits"), shape: shape("few") }).more).toBe(
      "Ob das so bleibt, ist mit 7 Scheiben noch nicht sicher."
    )
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

  it("Treffer außerhalb des Bilds", () => {
    expect(outsideText(1)).toBe("1 Schuss liegt außerhalb des Bilds.")
    expect(outsideText(3)).toBe("3 Schüsse liegen außerhalb des Bilds.")
  })

  it("ohne Scheibe im Zeitraum nennt der Hinweis den letzten Abend", () => {
    expect(emptyPeriodText("2026-10-09", "Europe/Berlin")).toBe(
      "Keine Scheibe in diesem Zeitraum. Deine letzte Scheibe ist vom 09.10.2026. Wähle oben einen anderen Zeitraum oder eine andere Art."
    )
    expect(emptyPeriodText(null, "Europe/Berlin")).toBe(
      "Keine Scheibe in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine andere Art."
    )
  })
})
