import { describe, expect, it } from "vitest"
import { sortStandings } from "./bestOfStandingsSort"
import type { BestOfStandingRow, DirectResult, HeadToHead } from "./bestOfStandingsTypes"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal row. Only the sort-relevant fields matter. */
function mkRow(
  id: string,
  lastName: string,
  stats: { wins?: number; duelDiff?: number; duelsWon?: number } = {}
): BestOfStandingRow {
  return {
    participantId: id,
    firstName: "F",
    lastName,
    withdrawn: false,
    played: 0,
    wins: stats.wins ?? 0,
    losses: 0,
    duelsWon: stats.duelsWon ?? 0,
    duelsLost: 0,
    duelDiff: stats.duelDiff ?? 0,
    bestRingteiler: null,
    bestRings: null,
    directComparison: null,
    rank: 0,
  }
}

/** Build a head-to-head map from "winner beat loser SATZ" tuples. */
function mkH2H(
  matches: Array<{ winner: string; loser: string; satz: [number, number] }>
): HeadToHead {
  const h2h: HeadToHead = new Map()
  const set = (p: string, o: string, r: DirectResult): void => {
    const inner = h2h.get(p) ?? new Map()
    inner.set(o, r)
    h2h.set(p, inner)
  }
  for (const m of matches) {
    set(m.winner, m.loser, { duelsWon: m.satz[0], duelsLost: m.satz[1], won: true })
    set(m.loser, m.winner, { duelsWon: m.satz[1], duelsLost: m.satz[0], won: false })
  }
  return h2h
}

const tied = { wins: 3, duelDiff: 2, duelsWon: 10 }

// ---------------------------------------------------------------------------

describe("sortStandings — direct comparison (Kriterium 4)", () => {
  it("2er-Gleichstand, gespielt: direkter Sieger steht oben (auch gegen die Alphabetik)", () => {
    // Loser is alphabetically first → proves head-to-head, not the name, decides.
    const rows = [mkRow("L", "Alpha", tied), mkRow("W", "Zeta", tied)]
    const h2h = mkH2H([{ winner: "W", loser: "L", satz: [2, 1] }])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["W", "L"])
    expect(sorted[0].directComparison).toEqual({
      kind: "decided",
      result: "win",
      satz: [2, 1],
      opponent: "Alpha",
    })
    expect(sorted[1].directComparison).toEqual({
      kind: "decided",
      result: "loss",
      satz: [1, 2],
      opponent: "Zeta",
    })
  })

  it("2er-Gleichstand, Begegnung offen: alphabetisch + open-Annotation mit Gegner", () => {
    const rows = [mkRow("Z", "Zeta", tied), mkRow("A", "Alpha", tied)]

    const sorted = sortStandings(rows, mkH2H([]))

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "Z"]) // alphabetisch
    expect(sorted[0].directComparison).toEqual({ kind: "open", opponent: "Zeta" })
    expect(sorted[1].directComparison).toEqual({ kind: "open", opponent: "Alpha" })
  })

  it("kein Gleichstand: directComparison ist null (Platz folgt aus den linken Spalten)", () => {
    const rows = [
      mkRow("A", "Aaa", { wins: 3, duelDiff: 5, duelsWon: 12 }),
      mkRow("B", "Bbb", { wins: 2, duelDiff: 1, duelsWon: 8 }),
    ]

    const sorted = sortStandings(rows, mkH2H([]))

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "B"])
    expect(sorted[0].directComparison).toBeNull()
    expect(sorted[1].directComparison).toBeNull()
  })

  it("direkter Vergleich greift erst NACH der Satzdifferenz (Position 4, nicht früher)", () => {
    // A schlug B direkt, aber B hat die bessere Satzdifferenz → B oben; kein Gleichstand bei Krit. 2.
    const rows = [
      mkRow("A", "Aaa", { wins: 3, duelDiff: 2, duelsWon: 9 }),
      mkRow("B", "Bbb", { wins: 3, duelDiff: 5, duelsWon: 11 }),
    ]
    const h2h = mkH2H([{ winner: "A", loser: "B", satz: [2, 1] }])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["B", "A"])
    // Nicht punktgleich (Satzdiff trennt) → keine Direktvergleich-Annotation.
    expect(sorted[0].directComparison).toBeNull()
    expect(sorted[1].directComparison).toBeNull()
  })

  it("3er-Gleichstand, lineare Mini-Liga (A>B>C): nach Direktbilanz, record-Annotation", () => {
    const rows = [mkRow("C", "Ccc", tied), mkRow("B", "Bbb", tied), mkRow("A", "Aaa", tied)]
    const h2h = mkH2H([
      { winner: "A", loser: "B", satz: [2, 1] },
      { winner: "A", loser: "C", satz: [2, 0] },
      { winner: "B", loser: "C", satz: [2, 1] },
    ])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "B", "C"])
    expect(sorted[0].directComparison).toEqual({ kind: "record", wins: 2, losses: 0 })
    expect(sorted[1].directComparison).toEqual({ kind: "record", wins: 1, losses: 1 })
    expect(sorted[2].directComparison).toEqual({ kind: "record", wins: 0, losses: 2 })
  })

  it("3er-Gleichstand, zyklisch (A>B>C>A): alphabetisch + even-Annotation", () => {
    const rows = [mkRow("B", "Bbb", tied), mkRow("C", "Ccc", tied), mkRow("A", "Aaa", tied)]
    const h2h = mkH2H([
      { winner: "A", loser: "B", satz: [2, 1] },
      { winner: "B", loser: "C", satz: [2, 1] },
      { winner: "C", loser: "A", satz: [2, 1] },
    ])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "B", "C"]) // alle Bilanz 0 → alphabetisch
    for (const r of sorted) expect(r.directComparison).toEqual({ kind: "even" })
  })

  it("3er-Gleichstand mit noch offener interner Begegnung: open für die Unentschiedenen", () => {
    // A schlägt B und C; B vs C noch nicht gespielt.
    const rows = [mkRow("A", "Aaa", tied), mkRow("B", "Bbb", tied), mkRow("C", "Ccc", tied)]
    const h2h = mkH2H([
      { winner: "A", loser: "B", satz: [2, 1] },
      { winner: "A", loser: "C", satz: [2, 0] },
    ])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "B", "C"])
    expect(sorted[0].directComparison).toEqual({ kind: "record", wins: 2, losses: 0 })
    expect(sorted[1].directComparison).toEqual({ kind: "open", opponent: null })
    expect(sorted[2].directComparison).toEqual({ kind: "open", opponent: null })
  })

  it("4er-Gleichstand mit gespaltener Bilanz (+1,+1,-1,-1): record statt even, Reihenfolge erklärt", () => {
    // Alle Begegnungen gespielt. Direktbilanzen: A=+1, B=+1, C=-1, D=-1.
    //   B>A, A>C, A>D, C>B, B>D, D>C → A 2:1, B 2:1, C 1:2, D 1:2
    // Da die Gruppe NICHT durchgehend gleichauf ist, zeigt jede Zeile ihre echte Bilanz
    // (sonst läse alles "ausgeglichen" und die Platzierung A,B vor C,D wäre unbegründet).
    const rows = [
      mkRow("C", "Ccc", tied),
      mkRow("A", "Aaa", tied),
      mkRow("D", "Ddd", tied),
      mkRow("B", "Bbb", tied),
    ]
    const h2h = mkH2H([
      { winner: "B", loser: "A", satz: [2, 1] },
      { winner: "A", loser: "C", satz: [2, 0] },
      { winner: "A", loser: "D", satz: [2, 0] },
      { winner: "C", loser: "B", satz: [2, 1] },
      { winner: "B", loser: "D", satz: [2, 0] },
      { winner: "D", loser: "C", satz: [2, 1] },
    ])

    const sorted = sortStandings(rows, h2h)

    expect(sorted.map((r) => r.participantId)).toEqual(["A", "B", "C", "D"])
    expect(sorted[0].directComparison).toEqual({ kind: "record", wins: 2, losses: 1 })
    expect(sorted[1].directComparison).toEqual({ kind: "record", wins: 2, losses: 1 })
    expect(sorted[2].directComparison).toEqual({ kind: "record", wins: 1, losses: 2 })
    expect(sorted[3].directComparison).toEqual({ kind: "record", wins: 1, losses: 2 })
  })
})
