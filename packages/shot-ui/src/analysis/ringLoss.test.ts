import { ringLossSplit, type RingLossSplit } from "@vereinsheim/shot-core/analysis"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { analysisInput } from "./input"
import { shownRingLoss } from "./ringLoss"
import { fortyCard } from "./testCard"

const CARD = fortyCard()
const split = (shots = CARD) => ringLossSplit(analysisInput(shots, "decimal", LP_10M).base, LP_10M)!
const centered = CARD.map((s) =>
  s.kind === "match" && s.xUm !== null && s.yUm !== null
    ? { ...s, xUm: s.xUm + 3500, yUm: s.yUm - 2200 }
    : s
)

describe("Ringverlust für Kachel und Legende", () => {
  it("mit Lage-Anteil: beide Teile wie im Fachkern, zusammen der Ringverlust", () => {
    const s = split()
    expect(s.positionLoss.decimal).toBeGreaterThan(0)
    const shown = shownRingLoss(s, "decimal")
    expect(shown).toEqual({
      position: s.positionLoss.decimal,
      spread: s.spreadLoss.decimal,
      negative: null,
    })
    expect(shown.position! + shown.spread).toBeCloseTo(s.total!.decimal, 6)
  })

  it("Lage kostet nichts: die Streuung trägt den ganzen Ringverlust, die Rohzahl nur für den Satz", () => {
    const s = split(centered)
    expect(s.positionLoss.decimal).toBeLessThan(0)
    const shown = shownRingLoss(s, "decimal")
    expect(shown.position).toBeNull()
    expect(shown.spread).toBeCloseTo(s.total!.decimal, 6)
    expect(shown.negative).toBe(s.positionLoss.decimal)
  })

  it("ein Anteil, der gerundet null zeigt, kostet nichts und hat keinen Satz", () => {
    const s = split()
    const tiny: RingLossSplit = {
      ...s,
      positionLoss: { decimal: 0.04, rings: 0 },
      spreadLoss: { decimal: 5, rings: 5 },
    }
    expect(shownRingLoss(tiny, "decimal")).toEqual({ position: null, spread: 5.04, negative: null })
    expect(
      shownRingLoss({ ...tiny, positionLoss: { decimal: -0.03, rings: 0 } }, "decimal")
    ).toEqual({
      position: null,
      spread: 4.97,
      negative: null,
    })
    expect(shownRingLoss(tiny, "rings")).toEqual({ position: null, spread: 5, negative: null })
  })
})
