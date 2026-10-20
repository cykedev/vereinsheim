import { describe, expect, it } from "vitest"

import { pairingOutcome } from "./outcome"
import type { MatchResultSummary } from "./types"

const result = (
  participantId: string,
  rings: number,
  teiler: number,
  ringteiler: number,
  correctedTeiler = teiler
): MatchResultSummary => ({
  participantId,
  rings,
  teiler,
  correctedTeiler,
  ringteiler,
  duelNumber: null,
  isTiebreak: false,
})

describe("pairingOutcome", () => {
  it("Wertung nach Teiler, gemischt: der korrigierte Teiler entscheidet", () => {
    // Luftpistole Teiler 90 (korrigiert 30,0) gegen Luftgewehr Teiler 35
    expect(pairingOutcome(result("a", 95, 90, 35, 30), result("b", 95, 35, 40), "TEILER")).toBe(
      "HOME_WIN"
    )
  })

  it("Wertung nach Ringen: mehr Ringe, nicht der kleinere Ringteiler", () => {
    expect(pairingOutcome(result("a", 97, 80, 83), result("b", 96, 5, 9), "RINGS")).toBe("HOME_WIN")
  })

  it("Wertung nach Ringteiler: der kleinere Ringteiler", () => {
    expect(pairingOutcome(result("a", 97, 80, 83), result("b", 96, 5, 9), "RINGTEILER")).toBe(
      "AWAY_WIN"
    )
  })
})
