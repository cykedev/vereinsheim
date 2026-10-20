import { describe, expect, it } from "vitest"

import type { MatchResultSummary } from "@/lib/matchups/types"
import { deriveBestOfLabel } from "../schedule-view/bestOfLabel"
import { countDuelWins, deriveMatchStatus } from "./bestOfStatus"

// Gemischt, Wertung nach Teiler: Heim schießt Luftpistole (Teiler 90, korrigiert 30,0), Gast Luftgewehr (Teiler 35).
// Nach dem korrigierten Teiler gewinnt Heim jedes Duell, nach dem Teiler vom Ausdruck der Gast.
const side = (participantId: string, duelNumber: number, teiler: number, correctedTeiler: number) =>
  ({
    participantId,
    rings: 95,
    teiler,
    correctedTeiler,
    ringteiler: 100 - 95 + correctedTeiler,
    duelNumber,
    isTiebreak: false,
  }) satisfies MatchResultSummary
const series: MatchResultSummary[] = [1, 2].flatMap((n) => [
  side("h", n, 90, 30),
  side("a", n, 35, 35),
])

describe("Best-of gemischt nach Teiler: Anzeige wie Wertung", () => {
  it("Status im Eingabedialog", () => {
    expect(deriveMatchStatus("h", "a", series, "TEILER", null, null, 3, false)).toEqual({
      kind: "complete",
      winner: "A",
    })
  })

  it("Siege je Seite", () => {
    expect(
      countDuelWins("h", "a", series, "TEILER", null, null, { kind: "complete", winner: "A" })
    ).toEqual({ homeWins: 2, awayWins: 0 })
  })

  it("Ergebnis und Sieger im Spielplan", () => {
    expect(deriveBestOfLabel("h", "a", series, "TEILER", null, null, 3, false)).toMatchObject({
      label: "2:0",
      winner: "home",
    })
  })
})
