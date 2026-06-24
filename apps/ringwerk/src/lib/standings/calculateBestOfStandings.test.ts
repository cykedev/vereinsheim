import { describe, expect, it } from "vitest"
import {
  calculateBestOfStandings,
  type BestOfStandingsConfig,
  type BestOfStandingsMatchup,
  type BestOfStandingsParticipant,
  type BestOfStandingRow,
} from "./calculateBestOfStandings"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal non-withdrawn participant. */
function mkParticipant(
  id: string,
  firstName = "F",
  lastName = "L",
  withdrawn = false
): BestOfStandingsParticipant {
  return { id, firstName, lastName, withdrawn }
}

/** Build a RINGTEILER series entry for one participant. */
function mkSeries(
  participantId: string,
  duelNumber: number,
  rings: number,
  teiler: number,
  {
    isTiebreak = false,
    ringteiler = teiler, // simplify: ringteiler == teiler when faktor=1
    teilerFaktor = 1,
  }: { isTiebreak?: boolean; ringteiler?: number; teilerFaktor?: number } = {}
) {
  return {
    participantId,
    duelNumber,
    isTiebreak,
    rings,
    teiler,
    ringteiler,
    teilerFaktor,
  }
}

/** Standard best-of-3, RINGTEILER, fixed discipline, no tiebreakers. */
const stdConfig: BestOfStandingsConfig = {
  scoringMode: "RINGTEILER",
  bestOf: 3,
  playAll: true,
  tiebreaker1: null,
  tiebreaker2: null,
  competitionDisciplineId: "disc-1",
}

/** Find a row for a given participantId. */
function row(rows: BestOfStandingRow[], id: string): BestOfStandingRow {
  const r = rows.find((r) => r.participantId === id)
  if (!r) throw new Error(`No row for ${id}`)
  return r
}

// ---------------------------------------------------------------------------
// Test 1: Clean ranking — 4 participants, single round-robin, all decided
// ---------------------------------------------------------------------------
describe("4-participant round robin — clean ranking", () => {
  // A beats B, A beats C, A beats D → 3W
  // B beats C, B beats D           → 2W
  // C beats D                      → 1W
  // D loses all                    → 0W
  //
  // Each match is best-of-3, playAll=true.
  // In RINGTEILER lower wins. We use correctedTeiler = teiler (factor=1, fixed discipline).
  // duel outcomes:
  //   A(teiler=10) < B(teiler=20) → A wins duel
  //   We make all 3 duels go the same way per match to get clean 3:0 scores.

  const participants = [
    mkParticipant("A", "Alice", "Alpha"),
    mkParticipant("B", "Bob", "Beta"),
    mkParticipant("C", "Carl", "Gamma"),
    mkParticipant("D", "Dave", "Delta"),
  ]

  function beatMatchup(
    homeId: string,
    awayId: string,
    homeTeiler: number,
    awayTeiler: number
  ): BestOfStandingsMatchup {
    // home wins all 3 duels
    return {
      homeParticipantId: homeId,
      awayParticipantId: awayId,
      series: [1, 2, 3].flatMap((n) => [
        mkSeries(homeId, n, 90, homeTeiler),
        mkSeries(awayId, n, 80, awayTeiler),
      ]),
    }
  }

  const matchups: BestOfStandingsMatchup[] = [
    beatMatchup("A", "B", 10, 20),
    beatMatchup("A", "C", 10, 30),
    beatMatchup("A", "D", 10, 40),
    beatMatchup("B", "C", 15, 30),
    beatMatchup("B", "D", 15, 40),
    beatMatchup("C", "D", 20, 40),
  ]

  const rows = calculateBestOfStandings(participants, matchups, stdConfig)

  it("returns 4 rows", () => {
    expect(rows).toHaveLength(4)
  })

  it("A ranks 1st with 3 wins", () => {
    const r = row(rows, "A")
    expect(r.rank).toBe(1)
    expect(r.wins).toBe(3)
    expect(r.losses).toBe(0)
    expect(r.played).toBe(3)
  })

  it("B ranks 2nd with 2 wins", () => {
    const r = row(rows, "B")
    expect(r.rank).toBe(2)
    expect(r.wins).toBe(2)
    expect(r.losses).toBe(1)
  })

  it("C ranks 3rd with 1 win", () => {
    const r = row(rows, "C")
    expect(r.rank).toBe(3)
    expect(r.wins).toBe(1)
    expect(r.losses).toBe(2)
  })

  it("D ranks 4th with 0 wins", () => {
    const r = row(rows, "D")
    expect(r.rank).toBe(4)
    expect(r.wins).toBe(0)
    expect(r.losses).toBe(3)
  })

  it("duelDiff for A is +9 (won 9 duels, lost 0)", () => {
    // A wins all 3 duels in each of 3 matches = 9 duels won, 0 lost
    const r = row(rows, "A")
    expect(r.duelsWon).toBe(9)
    expect(r.duelsLost).toBe(0)
    expect(r.duelDiff).toBe(9)
  })

  it("duelDiff for D is -9 (won 0, lost 9)", () => {
    const r = row(rows, "D")
    expect(r.duelsWon).toBe(0)
    expect(r.duelsLost).toBe(9)
    expect(r.duelDiff).toBe(-9)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Circular 3-way tie broken by duelDiff
// ---------------------------------------------------------------------------
describe("3-way tie on wins — broken by Satzdifferenz", () => {
  // All three end on 1 win / 1 loss (tied on wins). Head-to-head is circular
  // (A beat B, B beat C, C beat A). It is criterion 4 (after Satzdifferenz), so
  // here it is never reached — the Satzdifferenz already separates the three.
  //   A vs B: A wins 3:0 · B vs C: B wins 3:0 · C vs A: C wins 2:1
  //   Satzdifferenz: A = +3 −1 = +2 · B = −3 +3 = 0 · C = +2 −3 = −2
  //   Ranking: A(+2) > B(0) > C(−2)

  const participants = [mkParticipant("A"), mkParticipant("B"), mkParticipant("C")]

  // A vs B: A wins all 3 duels (3:0)
  const matchupAB: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [
      mkSeries("A", n, 90, 10), // A: teiler 10 (lower = better in RINGTEILER)
      mkSeries("B", n, 80, 20),
    ]),
  }

  // B vs C: B wins all 3 duels (3:0)
  const matchupBC: BestOfStandingsMatchup = {
    homeParticipantId: "B",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [mkSeries("B", n, 90, 10), mkSeries("C", n, 80, 20)]),
  }

  // C vs A: C wins 2, A wins 1 (2:1 — so C wins the match)
  // duel 1: C(10) < A(20) → C wins
  // duel 2: C(10) < A(20) → C wins
  // duel 3: A(10) < C(20) → A wins
  const matchupCA: BestOfStandingsMatchup = {
    homeParticipantId: "C",
    awayParticipantId: "A",
    series: [
      mkSeries("C", 1, 90, 10),
      mkSeries("A", 1, 80, 20),
      mkSeries("C", 2, 90, 10),
      mkSeries("A", 2, 80, 20),
      mkSeries("C", 3, 80, 20),
      mkSeries("A", 3, 90, 10),
    ],
  }

  const rows = calculateBestOfStandings(participants, [matchupAB, matchupBC, matchupCA], stdConfig)

  it("all 3 have 1 win and 1 loss", () => {
    for (const id of ["A", "B", "C"]) {
      const r = row(rows, id)
      expect(r.wins).toBe(1)
      expect(r.losses).toBe(1)
    }
  })

  it("all tied on 1 win — Satzdifferenz separates them", () => {
    // Head-to-head is circular and never reached here; the Satzdifferenz decides:
    //   A: wins 3 duels vs B, loses 1 duel vs C → 3-1 = +2
    //   B: wins 3 duels vs C, loses 3 duels vs A → 3-3 = 0
    //   C: wins 2 duels vs A, loses 3 duels vs B → 2-4 = -2
    expect(row(rows, "A").duelDiff).toBe(2)
    expect(row(rows, "B").duelDiff).toBe(0)
    expect(row(rows, "C").duelDiff).toBe(-2)
  })

  it("A ranks 1st (highest duelDiff +2)", () => {
    expect(row(rows, "A").rank).toBe(1)
  })

  it("B ranks 2nd (duelDiff 0)", () => {
    expect(row(rows, "B").rank).toBe(2)
  })

  it("C ranks 3rd (lowest duelDiff -1)", () => {
    expect(row(rows, "C").rank).toBe(3)
  })
})

describe("3-way tie on wins — Satzdifferenz values are correct", () => {
  const participants = [mkParticipant("A"), mkParticipant("B"), mkParticipant("C")]

  const matchupAB: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [mkSeries("A", n, 90, 10), mkSeries("B", n, 80, 20)]),
  }
  const matchupBC: BestOfStandingsMatchup = {
    homeParticipantId: "B",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [mkSeries("B", n, 90, 10), mkSeries("C", n, 80, 20)]),
  }
  const matchupCA: BestOfStandingsMatchup = {
    homeParticipantId: "C",
    awayParticipantId: "A",
    series: [
      mkSeries("C", 1, 90, 10),
      mkSeries("A", 1, 80, 20),
      mkSeries("C", 2, 90, 10),
      mkSeries("A", 2, 80, 20),
      mkSeries("C", 3, 80, 20),
      mkSeries("A", 3, 90, 10),
    ],
  }

  const rows = calculateBestOfStandings(participants, [matchupAB, matchupBC, matchupCA], stdConfig)

  it("A duelDiff = +2", () => expect(row(rows, "A").duelDiff).toBe(2))
  it("B duelDiff = 0", () => expect(row(rows, "B").duelDiff).toBe(0))
  it("C duelDiff = -2", () => expect(row(rows, "C").duelDiff).toBe(-2))
})

// ---------------------------------------------------------------------------
// Head-to-head is criterion 4 — Satzdifferenz (criterion 2) outranks a direct win
// ---------------------------------------------------------------------------
describe("Head-to-head loser ranks higher with better Satzdifferenz", () => {
  // A beats B directly (2:1), but B's overall Satzdifferenz is far better.
  // Head-to-head is only criterion 4 (after Satzdifferenz), so B ranks above A here.
  //   A: beat B (2:1), lost to C (0:3), beat D (3:0) → 2 wins, Satzdiff +1
  //   B: lost to A (1:2), beat C (3:0), beat D (3:0) → 2 wins, Satzdiff +5
  //   C: beat A (3:0), lost to B (0:3), beat D (3:0) → 2 wins, Satzdiff +3
  //   D: lost to all                                  → 0 wins, Satzdiff -9
  //   Ranking: B(+5) > C(+3) > A(+1) > D
  const participants = [
    mkParticipant("A"),
    mkParticipant("B"),
    mkParticipant("C"),
    mkParticipant("D"),
  ]

  const win30 = (winner: string, loser: string): BestOfStandingsMatchup => ({
    homeParticipantId: winner,
    awayParticipantId: loser,
    series: [1, 2, 3].flatMap((n) => [mkSeries(winner, n, 90, 10), mkSeries(loser, n, 90, 20)]),
  })

  const matchups: BestOfStandingsMatchup[] = [
    {
      // A vs B: A wins 2:1
      homeParticipantId: "A",
      awayParticipantId: "B",
      series: [
        mkSeries("A", 1, 90, 10),
        mkSeries("B", 1, 90, 20),
        mkSeries("A", 2, 90, 10),
        mkSeries("B", 2, 90, 20),
        mkSeries("A", 3, 90, 20),
        mkSeries("B", 3, 90, 10),
      ],
    },
    win30("C", "A"),
    win30("A", "D"),
    win30("B", "C"),
    win30("B", "D"),
    win30("C", "D"),
  ]

  const rows = calculateBestOfStandings(participants, matchups, stdConfig)

  it("A and B are tied on wins; B has the better Satzdifferenz", () => {
    expect(row(rows, "A").wins).toBe(2)
    expect(row(rows, "B").wins).toBe(2)
    expect(row(rows, "A").duelDiff).toBe(1)
    expect(row(rows, "B").duelDiff).toBe(5)
  })

  it("B ranks above A despite losing the direct duel to A", () => {
    expect(row(rows, "B").rank).toBeLessThan(row(rows, "A").rank)
    expect(row(rows, "B").rank).toBe(1)
  })

  it("A (the head-to-head winner) is last in the 2-win group", () => {
    expect(row(rows, "C").rank).toBe(2)
    expect(row(rows, "A").rank).toBe(3)
    expect(row(rows, "D").rank).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Match decided by Stechschuss (tiebreak)
// ---------------------------------------------------------------------------
describe("Match decided by Stechschuss (tiebreak)", () => {
  // Best-of-3, playAll=true:
  // Regular duels: duel 1 → A wins, duel 2 → B wins, duel 3 → TIE
  // After 3 regular duels: 1 win each → needs_tiebreak
  // Tiebreak round (duelNumber=4, isTiebreak=true): A wins
  // Result: A is the match winner.
  //
  // duelDiff: A won duel 1, lost duel 2, and the TIE in duel 3 is awarded to A
  // (the Stechschuss winner) → A: 2 won, 1 lost = +1; B: 1 won, 2 lost = -1.

  const participants = [mkParticipant("A"), mkParticipant("B")]

  const config: BestOfStandingsConfig = {
    scoringMode: "RINGTEILER",
    bestOf: 3,
    playAll: true,
    tiebreaker1: null,
    tiebreaker2: null,
    competitionDisciplineId: "disc-1",
  }

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [
      // Duel 1: A wins (lower ringteiler; ringteiler defaults to teiler in mkSeries)
      mkSeries("A", 1, 90, 10),
      mkSeries("B", 1, 90, 20),
      // Duel 2: B wins
      mkSeries("A", 2, 90, 20),
      mkSeries("B", 2, 90, 10),
      // Duel 3: TIE (same teiler, same rings)
      mkSeries("A", 3, 90, 15),
      mkSeries("B", 3, 90, 15),
      // Tiebreak round 1 (duelNumber=4, isTiebreak=true): A wins.
      // A Stechschuss stores the single decimal shot in `rings`; higher shot wins.
      mkSeries("A", 4, 9.8, 0, { isTiebreak: true }),
      mkSeries("B", 4, 9.5, 0, { isTiebreak: true }),
    ],
  }

  const rows = calculateBestOfStandings(participants, [matchup], config)

  it("A wins the match", () => {
    expect(row(rows, "A").wins).toBe(1)
    expect(row(rows, "A").losses).toBe(0)
  })

  it("B loses the match", () => {
    expect(row(rows, "B").wins).toBe(0)
    expect(row(rows, "B").losses).toBe(1)
  })

  it("played = 1 for both", () => {
    expect(row(rows, "A").played).toBe(1)
    expect(row(rows, "B").played).toBe(1)
  })

  it("Stechschuss-decided tie counts for the winner: A=2:1 (+1), B=1:2 (-1)", () => {
    // A won duel 1, lost duel 2; duel 3 (TIE) is awarded to A as the Stechschuss winner.
    expect(row(rows, "A").duelsWon).toBe(2)
    expect(row(rows, "A").duelsLost).toBe(1)
    expect(row(rows, "A").duelDiff).toBe(1)
    expect(row(rows, "B").duelsWon).toBe(1)
    expect(row(rows, "B").duelsLost).toBe(2)
    expect(row(rows, "B").duelDiff).toBe(-1)
  })

  it("bestRingteiler does NOT include tiebreak series", () => {
    // A's regular series teilers: 10, 20, 15 → min = 10
    expect(row(rows, "A").bestRingteiler).toBe(10)
    // B's regular series teilers: 20, 10, 15 → min = 10
    expect(row(rows, "B").bestRingteiler).toBe(10)
  })

  it("A ranks 1st", () => {
    expect(row(rows, "A").rank).toBe(1)
    expect(row(rows, "B").rank).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Test 4: Withdrawn participant
// ---------------------------------------------------------------------------
describe("Withdrawn participant", () => {
  // 3 participants: A, B, C. C is withdrawn.
  // Matchups: A vs B (A wins), A vs C, B vs C — last two involve withdrawn C.
  // Only A vs B should count.

  const participants = [
    mkParticipant("A"),
    mkParticipant("B"),
    mkParticipant("C", "Chuck", "Charlie", true),
  ]

  const matchupAB: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [mkSeries("A", n, 90, 10), mkSeries("B", n, 80, 20)]),
  }

  const matchupAC: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [mkSeries("A", n, 90, 10), mkSeries("C", n, 80, 20)]),
  }

  const matchupBC: BestOfStandingsMatchup = {
    homeParticipantId: "B",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [mkSeries("B", n, 90, 10), mkSeries("C", n, 80, 20)]),
  }

  const rows = calculateBestOfStandings(participants, [matchupAB, matchupAC, matchupBC], stdConfig)

  it("returns 3 rows", () => {
    expect(rows).toHaveLength(3)
  })

  it("C is withdrawn and ranked last", () => {
    const c = row(rows, "C")
    expect(c.withdrawn).toBe(true)
    expect(c.rank).toBe(3) // activeCount=2, so withdrawn rank = 3
  })

  it("C has zero stats (their matches not counted)", () => {
    const c = row(rows, "C")
    expect(c.wins).toBe(0)
    expect(c.losses).toBe(0)
    expect(c.played).toBe(0)
    expect(c.duelsWon).toBe(0)
    expect(c.duelsLost).toBe(0)
  })

  it("A has 1 win from A vs B only", () => {
    const a = row(rows, "A")
    expect(a.wins).toBe(1)
    expect(a.played).toBe(1)
  })

  it("B has 0 wins (lost to A)", () => {
    const b = row(rows, "B")
    expect(b.wins).toBe(0)
    expect(b.losses).toBe(1)
    expect(b.played).toBe(1)
  })

  it("A ranks 1st, B ranks 2nd", () => {
    expect(row(rows, "A").rank).toBe(1)
    expect(row(rows, "B").rank).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Test 5: BYE matchup is skipped
// ---------------------------------------------------------------------------
describe("BYE matchup is skipped", () => {
  const participants = [mkParticipant("A"), mkParticipant("B")]

  const matchupABye: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: null, // BYE
    series: [],
  }

  const matchupAB: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [mkSeries("A", n, 90, 10), mkSeries("B", n, 80, 20)]),
  }

  const rows = calculateBestOfStandings(participants, [matchupABye, matchupAB], stdConfig)

  it("BYE does not contribute to A's wins or played", () => {
    // Only A vs B counts
    expect(row(rows, "A").wins).toBe(1)
    expect(row(rows, "A").played).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Test 6: 2-way tie, direct match not played → alphabetical + "open" annotation
// ---------------------------------------------------------------------------
describe("2-way tie without a direct match — alphabetical, annotated open", () => {
  // A and B both beat C but never played each other (incomplete round-robin).
  // They tie on wins/duelDiff/duelsWon; the direct comparison cannot decide →
  // alphabetical order, each row annotated "open" with the not-yet-played opponent.
  // RINGS mode — proves the tiebreak no longer depends on the scoring value.

  const participants = [
    mkParticipant("A", "Alice", "Alpha"),
    mkParticipant("B", "Bob", "Beta"),
    mkParticipant("C", "Carl", "Gamma"),
  ]

  const config: BestOfStandingsConfig = {
    scoringMode: "RINGS",
    bestOf: 3,
    playAll: true,
    tiebreaker1: null,
    tiebreaker2: null,
    competitionDisciplineId: "disc-1",
  }

  const matchupAC: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [
      mkSeries("A", n, 95, 0, { ringteiler: 0 }),
      mkSeries("C", n, 70, 0, { ringteiler: 0 }),
    ]),
  }

  const matchupBC: BestOfStandingsMatchup = {
    homeParticipantId: "B",
    awayParticipantId: "C",
    series: [1, 2, 3].flatMap((n) => [
      mkSeries("B", n, 93, 0, { ringteiler: 0 }),
      mkSeries("C", n, 68, 0, { ringteiler: 0 }),
    ]),
  }

  const rows = calculateBestOfStandings(participants, [matchupAC, matchupBC], config)

  it("A and B tie on wins, Satzdifferenz and Satzverhältnis", () => {
    expect(row(rows, "A").wins).toBe(1)
    expect(row(rows, "B").wins).toBe(1)
    expect(row(rows, "A").duelDiff).toBe(row(rows, "B").duelDiff)
    expect(row(rows, "A").duelsWon).toBe(row(rows, "B").duelsWon)
  })

  it("alphabetical order (Alpha before Beta) because the direct comparison is open", () => {
    expect(row(rows, "A").rank).toBe(1)
    expect(row(rows, "B").rank).toBe(2)
  })

  it("each row is annotated open with the not-yet-played opponent", () => {
    expect(row(rows, "A").directComparison).toEqual({ kind: "open", opponent: "Beta" })
    expect(row(rows, "B").directComparison).toEqual({ kind: "open", opponent: "Alpha" })
  })
})

// ---------------------------------------------------------------------------
// Test 7: 2-way tie broken by the direct comparison (Kriterium 4)
// ---------------------------------------------------------------------------
describe("2-way tie broken by the direct comparison", () => {
  // A and B tie on wins (2), Satzdifferenz (+1) and Satzverhältnis (5:4).
  // A beat B directly 2:1 → A ranks above B; both rows carry the decided annotation.
  //   A: beat B 2:1, beat C 3:0, lost to D 0:3
  //   B: lost to A 1:2, beat C 2:1, beat D 2:1
  // RINGTEILER mode (lower teiler wins the duel).

  const participants = [
    mkParticipant("A", "Anna", "Alpha"),
    mkParticipant("B", "Bob", "Beta"),
    mkParticipant("C", "Carl", "Gamma"),
    mkParticipant("D", "Dora", "Delta"),
  ]

  // A beats B 2:1 (A lower teiler in duels 1+2, B lower in duel 3).
  const matchupAB: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [
      mkSeries("A", 1, 90, 10),
      mkSeries("B", 1, 90, 20),
      mkSeries("A", 2, 90, 10),
      mkSeries("B", 2, 90, 20),
      mkSeries("A", 3, 90, 20),
      mkSeries("B", 3, 90, 10),
    ],
  }

  // home wins 3:0 (home teiler 10, away 20).
  const win30 = (home: string, away: string): BestOfStandingsMatchup => ({
    homeParticipantId: home,
    awayParticipantId: away,
    series: [1, 2, 3].flatMap((n) => [mkSeries(home, n, 90, 10), mkSeries(away, n, 90, 20)]),
  })

  // home wins 2:1 (home lower in duels 1+2, away lower in duel 3).
  const win21 = (home: string, away: string): BestOfStandingsMatchup => ({
    homeParticipantId: home,
    awayParticipantId: away,
    series: [
      mkSeries(home, 1, 90, 10),
      mkSeries(away, 1, 90, 20),
      mkSeries(home, 2, 90, 10),
      mkSeries(away, 2, 90, 20),
      mkSeries(home, 3, 90, 20),
      mkSeries(away, 3, 90, 10),
    ],
  })

  const matchups = [matchupAB, win30("A", "C"), win30("D", "A"), win21("B", "C"), win21("B", "D")]
  const rows = calculateBestOfStandings(participants, matchups, stdConfig)

  it("A and B tie on wins (2), Satzdifferenz (+1) and Satzverhältnis (5:4)", () => {
    expect(row(rows, "A").wins).toBe(2)
    expect(row(rows, "B").wins).toBe(2)
    expect(row(rows, "A").duelDiff).toBe(1)
    expect(row(rows, "B").duelDiff).toBe(1)
    expect(row(rows, "A").duelsWon).toBe(5)
    expect(row(rows, "B").duelsWon).toBe(5)
  })

  it("A ranks above B via the direct win (2:1)", () => {
    expect(row(rows, "A").rank).toBe(1)
    expect(row(rows, "B").rank).toBe(2)
  })

  it("both rows carry the decided annotation with satz + opponent", () => {
    expect(row(rows, "A").directComparison).toEqual({
      kind: "decided",
      result: "win",
      satz: [2, 1],
      opponent: "Beta",
    })
    expect(row(rows, "B").directComparison).toEqual({
      kind: "decided",
      result: "loss",
      satz: [1, 2],
      opponent: "Alpha",
    })
  })
})

// ---------------------------------------------------------------------------
// Test 8: Mixed discipline — effectiveTeilerFaktor applies
// ---------------------------------------------------------------------------
describe("Mixed discipline — effectiveTeilerFaktor applies", () => {
  // competitionDisciplineId = null → factor is active.
  // A: teiler=10, teilerFaktor=2 → correctedTeiler = 10*2 = 20
  // B: teiler=15, teilerFaktor=1 → correctedTeiler = 15*1 = 15 (lower = better in RINGTEILER)
  // Without factor correction, A(10) would beat B(15). With factor, B(15 corrected) beats A(20 corrected).
  // So in TEILER mode with factor: B wins each duel.

  const participants = [mkParticipant("A"), mkParticipant("B")]

  const config: BestOfStandingsConfig = {
    scoringMode: "TEILER",
    bestOf: 3,
    playAll: true,
    tiebreaker1: null,
    tiebreaker2: null,
    competitionDisciplineId: null, // mixed — factor active
  }

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [
      // A: teiler=10, factor=2 → corrected=20
      mkSeries("A", n, 90, 10, { teilerFaktor: 2 }),
      // B: teiler=15, factor=1 → corrected=15 (lower = wins)
      mkSeries("B", n, 90, 15, { teilerFaktor: 1 }),
    ]),
  }

  const rows = calculateBestOfStandings(participants, [matchup], config)

  it("B wins the match (corrected teiler 15 < 20)", () => {
    expect(row(rows, "B").wins).toBe(1)
    expect(row(rows, "A").wins).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 9: In-progress match (not all duels played) — not counted
// ---------------------------------------------------------------------------
describe("In-progress match is not counted as win or loss", () => {
  // best-of-3, playAll=true: only 1 duel played → in_progress → not counted
  const participants = [mkParticipant("A"), mkParticipant("B")]

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [mkSeries("A", 1, 90, 10), mkSeries("B", 1, 80, 20)], // only 1 of 3 duels played
  }

  const rows = calculateBestOfStandings(participants, [matchup], stdConfig)

  it("neither participant gets a win or loss", () => {
    expect(row(rows, "A").wins).toBe(0)
    expect(row(rows, "A").losses).toBe(0)
    expect(row(rows, "B").wins).toBe(0)
    expect(row(rows, "B").losses).toBe(0)
  })

  it("played = 0 for both", () => {
    expect(row(rows, "A").played).toBe(0)
    expect(row(rows, "B").played).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 10: TIE duels count for neither side in duelDiff
// ---------------------------------------------------------------------------
describe("TIE duels don't count towards duelsWon or duelsLost", () => {
  // Best-of-3, playAll=true, all 3 duels TIE → needs_tiebreak (no winner yet).
  const participants = [mkParticipant("A"), mkParticipant("B")]

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [
      mkSeries("A", n, 90, 10),
      mkSeries("B", n, 90, 10), // same → TIE
    ]),
  }

  const rows = calculateBestOfStandings(participants, [matchup], stdConfig)

  it("match is not counted as win or loss (needs_tiebreak → not complete)", () => {
    expect(row(rows, "A").wins).toBe(0)
    expect(row(rows, "A").losses).toBe(0)
  })

  it("duelsWon and duelsLost are both 0 for both participants", () => {
    expect(row(rows, "A").duelsWon).toBe(0)
    expect(row(rows, "A").duelsLost).toBe(0)
    expect(row(rows, "B").duelsWon).toBe(0)
    expect(row(rows, "B").duelsLost).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 11: Early clinch (playAll=false)
// ---------------------------------------------------------------------------
describe("Early clinch — playAll=false, best-of-3", () => {
  // A wins duels 1 and 2 → clinches (2 = ceil(3/2)) without playing duel 3.
  // Only 2 series pairs present.
  const participants = [mkParticipant("A"), mkParticipant("B")]

  const config: BestOfStandingsConfig = {
    ...stdConfig,
    playAll: false,
  }

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2].flatMap((n) => [mkSeries("A", n, 90, 10), mkSeries("B", n, 80, 20)]),
  }

  const rows = calculateBestOfStandings(participants, [matchup], config)

  it("A wins the match via early clinch", () => {
    expect(row(rows, "A").wins).toBe(1)
    expect(row(rows, "B").losses).toBe(1)
  })

  it("duelsWon for A = 2, duelsLost = 0", () => {
    expect(row(rows, "A").duelsWon).toBe(2)
    expect(row(rows, "A").duelsLost).toBe(0)
    expect(row(rows, "A").duelDiff).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Test 12: TEILER-mode match decided by Stechschuss
// Bug: tiebreak was routed through duelOutcome with scoringMode=TEILER,
// and Stechschuss series have teiler=0 → always TIE → never resolves.
// Fix: Stechschuss outcome is decided purely by shot value (rings field).
// ---------------------------------------------------------------------------
describe("TEILER-mode match decided by Stechschuss", () => {
  // Best-of-3, playAll=true, TEILER scoring:
  // Regular duel 1: A wins (teiler 2.0 < 3.0, factor=1 in fixed discipline)
  // Regular duel 2: B wins (teiler 2.0 < 3.0)
  // Regular duel 3: TIE (same teiler)
  // After 3 duels: 1:1 → needs_tiebreak
  // Stechschuss duel 4: A shot=9.8, B shot=9.5 → A wins (higher shot)
  // Result: A is the match winner.
  //
  // Before fix: tiebreak series have teiler=0, duelOutcome(TEILER, 0, 0) → TIE → never resolves.

  const participants = [mkParticipant("A"), mkParticipant("B")]

  const config: BestOfStandingsConfig = {
    scoringMode: "TEILER",
    bestOf: 3,
    playAll: true,
    tiebreaker1: null,
    tiebreaker2: null,
    competitionDisciplineId: "disc-1", // fixed discipline, factor=1
  }

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [
      // Duel 1: A wins (lower teiler = better in TEILER mode)
      mkSeries("A", 1, 90, 2.0, { teilerFaktor: 1 }),
      mkSeries("B", 1, 90, 3.0, { teilerFaktor: 1 }),
      // Duel 2: B wins
      mkSeries("A", 2, 90, 3.0, { teilerFaktor: 1 }),
      mkSeries("B", 2, 90, 2.0, { teilerFaktor: 1 }),
      // Duel 3: TIE (same teiler)
      mkSeries("A", 3, 90, 2.5, { teilerFaktor: 1 }),
      mkSeries("B", 3, 90, 2.5, { teilerFaktor: 1 }),
      // Stechschuss duel 4: A shot=9.8, B shot=9.5 → A wins (higher shot value in rings field)
      // teiler=0 because Stechschuss stores shot value in rings only
      mkSeries("A", 4, 9.8, 0, { isTiebreak: true, teilerFaktor: 1 }),
      mkSeries("B", 4, 9.5, 0, { isTiebreak: true, teilerFaktor: 1 }),
    ],
  }

  const rows = calculateBestOfStandings(participants, [matchup], config)

  it("A wins the match (Stechschuss decided by shot value, not teiler)", () => {
    expect(row(rows, "A").wins).toBe(1)
    expect(row(rows, "A").losses).toBe(0)
  })

  it("B loses the match", () => {
    expect(row(rows, "B").wins).toBe(0)
    expect(row(rows, "B").losses).toBe(1)
  })

  it("A ranks 1st", () => {
    expect(row(rows, "A").rank).toBe(1)
    expect(row(rows, "B").rank).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Test 13: TEILER-mode with corrected teiler (mixed discipline, factor active)
// Bug: evaluateMatchState passes raw teiler as correctedTeiler.
// Fix: apply effectiveTeilerFaktor via per-series teilerFaktor.
// This tests calculateBestOfStandings (which already had the fix);
// the corresponding bestOfActions test is in bestOfActions.test.ts.
// ---------------------------------------------------------------------------
describe("TEILER-mode mixed discipline — corrected teiler decides duels", () => {
  // A: teiler=10, factor=2 → correctedTeiler=20 (worse)
  // B: teiler=15, factor=1 → correctedTeiler=15 (better — lower wins in TEILER)
  // Without correction A(10) < B(15) → A would win each duel incorrectly.
  // With correction B(15) < A(20) → B wins each duel correctly.

  const participants = [mkParticipant("A"), mkParticipant("B")]

  const config: BestOfStandingsConfig = {
    scoringMode: "TEILER",
    bestOf: 3,
    playAll: true,
    tiebreaker1: null,
    tiebreaker2: null,
    competitionDisciplineId: null, // mixed — factor active
  }

  const matchup: BestOfStandingsMatchup = {
    homeParticipantId: "A",
    awayParticipantId: "B",
    series: [1, 2, 3].flatMap((n) => [
      mkSeries("A", n, 90, 10, { teilerFaktor: 2 }), // corrected: 20
      mkSeries("B", n, 90, 15, { teilerFaktor: 1 }), // corrected: 15 (lower wins)
    ]),
  }

  const rows = calculateBestOfStandings(participants, [matchup], config)

  it("B wins the match (corrected teiler 15 < 20)", () => {
    expect(row(rows, "B").wins).toBe(1)
    expect(row(rows, "A").wins).toBe(0)
  })
})
