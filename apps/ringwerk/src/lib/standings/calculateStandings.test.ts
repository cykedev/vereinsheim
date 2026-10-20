import { describe, it, expect } from "vitest"
import { calculateStandings } from "./calculateStandings"
import { hasLeagueResult } from "./standingsSort"
import type { StandingsParticipant, StandingsMatchup } from "./calculateStandings"

// Hilfsfunktion: Ergebnis für einen Teilnehmer; ohne Faktor ist der korrigierte Teiler der vom Ausdruck
function makeResult(
  participantId: string,
  rings: number,
  teiler: number,
  ringteiler: number,
  correctedTeiler = teiler
) {
  return { participantId, rings, teiler, ringteiler, correctedTeiler }
}

// Teilnehmer-Fixtures
const pA: StandingsParticipant = {
  id: "A",
  firstName: "Anna",
  lastName: "Müller",
  withdrawn: false,
}
const pB: StandingsParticipant = {
  id: "B",
  firstName: "Ben",
  lastName: "Schmidt",
  withdrawn: false,
}
const pC: StandingsParticipant = { id: "C", firstName: "Cara", lastName: "Klein", withdrawn: false }
const pD: StandingsParticipant = { id: "D", firstName: "Dan", lastName: "Wolf", withdrawn: true }

describe("calculateStandings – Grundfälle", () => {
  it("leere Tabelle wenn keine Paarungen", () => {
    const rows = calculateStandings([pA, pB], [])
    expect(rows).toHaveLength(2)
    expect(rows[0].points).toBe(0)
    expect(rows[0].played).toBe(0)
  })

  it("Sieg gibt 2 Punkte, Niederlage 0", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [
          makeResult("A", 96, 3.7, 7.7), // besserer Ringteiler
          makeResult("B", 96, 4.2, 8.2),
        ],
      },
    ]
    const rows = calculateStandings([pA, pB], matchups)
    const rowA = rows.find((r) => r.participantId === "A")!
    const rowB = rows.find((r) => r.participantId === "B")!

    expect(rowA.wins).toBe(1)
    expect(rowA.points).toBe(2)
    expect(rowB.losses).toBe(1)
    expect(rowB.points).toBe(0)
    expect(rowA.rank).toBe(1)
    expect(rowB.rank).toBe(2)
  })

  it("Unentschieden gibt je 1 Punkt", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [
          makeResult("A", 95, 5.0, 10.0),
          makeResult("B", 95, 5.0, 10.0), // identisch → DRAW
        ],
      },
    ]
    const rows = calculateStandings([pA, pB], matchups)
    const rowA = rows.find((r) => r.participantId === "A")!
    const rowB = rows.find((r) => r.participantId === "B")!

    expect(rowA.draws).toBe(1)
    expect(rowA.points).toBe(1)
    expect(rowB.draws).toBe(1)
    expect(rowB.points).toBe(1)
  })

  it("Freilos gibt 2 Punkte", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "bye1",
        status: "BYE",
        homeParticipantId: "A",
        awayParticipantId: null,
        results: [],
      },
    ]
    const rows = calculateStandings([pA, pB], matchups)
    const rowA = rows.find((r) => r.participantId === "A")!
    expect(rowA.byes).toBe(1)
    expect(rowA.points).toBe(2)
  })
})

describe("calculateStandings – Tabellenplätze", () => {
  it("sortiert nach Punkten absteigend", () => {
    // A gewinnt gegen B, C hat keine Spiele
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("B", 94, 5.0, 11.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pC], matchups)
    expect(rows[0].participantId).toBe("A") // 2 Punkte
    // B und C haben 0 Punkte → alphabetisch nach Nachname
    expect(rows[0].rank).toBe(1)
  })

  it("zurückgezogene Teilnehmer immer am Ende", () => {
    const matchups: StandingsMatchup[] = []
    const rows = calculateStandings([pA, pB, pD], matchups)
    const rowD = rows.find((r) => r.participantId === "D")!
    expect(rowD.withdrawn).toBe(true)
    // D ist am Ende (Rang 3)
    expect(rows[rows.length - 1].participantId).toBe("D")
  })

  it("Duelle mit zurückgezogenen Teilnehmern werden nicht gewertet", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "D", // D ist zurückgezogen
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("D", 90, 5.0, 15.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pD], matchups)
    const rowA = rows.find((r) => r.participantId === "A")!
    // Das Duell wird nicht gewertet
    expect(rowA.wins).toBe(0)
    expect(rowA.points).toBe(0)
  })
})

describe("calculateStandings – Direkter Vergleich", () => {
  it("direkter Vergleich entscheidet bei Punktgleichstand", () => {
    // A, B, C alle je 2 Punkte
    // A schlägt B direkt → A über B
    const matchups: StandingsMatchup[] = [
      {
        id: "m-AB",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("B", 94, 5.0, 11.0)],
      },
      {
        id: "m-BC",
        status: "COMPLETED",
        homeParticipantId: "B",
        awayParticipantId: "C",
        results: [makeResult("B", 95, 4.0, 9.0), makeResult("C", 93, 6.0, 13.0)],
      },
      {
        id: "m-CA",
        status: "COMPLETED",
        homeParticipantId: "C",
        awayParticipantId: "A",
        results: [makeResult("C", 97, 2.0, 5.0), makeResult("A", 95, 4.0, 9.0)],
      },
    ]
    // A: 1W+1L = 2pts, B: 1W+1L = 2pts, C: 1W+1L = 2pts
    const rows = calculateStandings([pA, pB, pC], matchups)
    // Alle 2 Punkte → direkter Vergleich
    // A vs B: A gewinnt (2dp), A vs C (verloren gegen C: 0dp) → A: 2dp
    // B vs A (verloren: 0dp), B vs C: B gewinnt (2dp) → B: 2dp
    // C vs A (gewonnen: 2dp), C vs B (verloren: 0dp) → C: 2dp
    // Alle gleich direkter Vergleich → bestRingteiler entscheidet
    // A: min(7.7, 9.0) = 7.7, B: min(11.0, 9.0) = 9.0, C: min(5.0, 13.0) = 5.0
    // → C (5.0) > A (7.7) > B (9.0)
    expect(rows[0].participantId).toBe("C")
    expect(rows[1].participantId).toBe("A")
    expect(rows[2].participantId).toBe("B")
  })
})

describe("calculateStandings – Bester Ringteiler", () => {
  it("bester Ringteiler = niedrigster Wert aller Duelle", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("B", 94, 5.0, 11.0)],
      },
      {
        id: "m2",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "C",
        results: [makeResult("A", 98, 1.5, 3.5), makeResult("C", 90, 8.0, 18.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pC], matchups)
    const rowA = rows.find((r) => r.participantId === "A")!
    expect(rowA.bestRingteiler).toBeCloseTo(3.5)
  })

  it("bestRingteiler ist null wenn keine Duelle gespielt", () => {
    const rows = calculateStandings([pA], [])
    expect(rows[0].bestRingteiler).toBeNull()
  })
})

describe("calculateStandings – scoringMode RINGS", () => {
  it("höhere Seriensumme gewinnt (RINGS-Modus)", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [
          makeResult("A", 97, 3.0, 6.0), // höhere Ringe → gewinnt
          makeResult("B", 94, 2.0, 8.0),
        ],
      },
    ]
    const rows = calculateStandings([pA, pB], matchups, "RINGS")
    const rowA = rows.find((r) => r.participantId === "A")!
    expect(rowA.wins).toBe(1)
    expect(rowA.rank).toBe(1)
  })

  it("bestRings = höchste Seriensumme aller Duelle", () => {
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.0, 7.0), makeResult("B", 94, 5.0, 11.0)],
      },
      {
        id: "m2",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "C",
        results: [makeResult("A", 99, 1.5, 4.5), makeResult("C", 90, 8.0, 18.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pC], matchups, "RINGS")
    const rowA = rows.find((r) => r.participantId === "A")!
    expect(rowA.bestRings).toBe(99)
  })

  it("bestRings ist null wenn keine Duelle gespielt", () => {
    const rows = calculateStandings([pA], [], "RINGS")
    expect(rows[0].bestRings).toBeNull()
  })

  it("Tiebreak bei Punktgleichstand: höhere bestRings gewinnt (RINGS-Modus)", () => {
    // A und B haben je 2 Punkte (je 1 Sieg gegen C)
    // A hat höhere bestRings → A vor B
    const matchups: StandingsMatchup[] = [
      {
        id: "m-AC",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "C",
        results: [makeResult("A", 98, 3.0, 5.0), makeResult("C", 90, 5.0, 15.0)],
      },
      {
        id: "m-BC",
        status: "COMPLETED",
        homeParticipantId: "B",
        awayParticipantId: "C",
        results: [makeResult("B", 95, 3.0, 8.0), makeResult("C", 90, 5.0, 15.0)],
      },
    ]
    // A: 2pts, bestRings=98 | B: 2pts, bestRings=95 | C: 0pts
    const rows = calculateStandings([pA, pB, pC], matchups, "RINGS")
    expect(rows[0].participantId).toBe("A")
    expect(rows[1].participantId).toBe("B")
  })
})

describe("calculateStandings – geteilte Plätze", () => {
  const zeta: StandingsParticipant = {
    id: "Z",
    firstName: "Zoe",
    lastName: "Zeta",
    withdrawn: false,
  }
  const alpha: StandingsParticipant = {
    id: "AL",
    firstName: "Ali",
    lastName: "Alpha",
    withdrawn: false,
  }
  const mitte: StandingsParticipant = {
    id: "MI",
    firstName: "Mia",
    lastName: "Mitte",
    withdrawn: false,
  }

  it("ohne gespieltes Duell stehen alle alphabetisch auf Platz 1", () => {
    const rows = calculateStandings([zeta, alpha, mitte], [])
    expect(rows.map((r) => r.lastName)).toEqual(["Alpha", "Mitte", "Zeta"])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1])
  })

  it("nur Zeilen, die erst der Name trennt, teilen den Platz", () => {
    // A schlägt B; C (Klein) und E (Adler) haben noch kein Duell.
    const pE: StandingsParticipant = {
      id: "E",
      firstName: "Eva",
      lastName: "Adler",
      withdrawn: false,
    }
    const matchups: StandingsMatchup[] = [
      {
        id: "m1",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("B", 94, 5.0, 11.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pC, pE], matchups)
    expect(rows.map((r) => r.participantId)).toEqual(["A", "B", "E", "C"])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 3])
  })

  it("bei gleichem Nachnamen entscheidet der Vorname die Reihenfolge, der Platz bleibt geteilt", () => {
    const karl: StandingsParticipant = {
      id: "K",
      firstName: "Karl",
      lastName: "Meier",
      withdrawn: false,
    }
    const anna: StandingsParticipant = {
      id: "N",
      firstName: "Anna",
      lastName: "Meier",
      withdrawn: false,
    }
    const rows = calculateStandings([karl, anna], [])
    expect(rows.map((r) => r.firstName)).toEqual(["Anna", "Karl"])
    expect(rows.map((r) => r.rank)).toEqual([1, 1])
  })
})

describe("calculateStandings – Direktpunkte trennen den Platz", () => {
  it("gleiche Punkte und gleicher Bestwert, aber direkter Sieg: getrennte Plätze", () => {
    // A schlägt B (A 7.7), B schlägt C (B 7.7) → A und B je 2 Punkte, Bestwert beide 7.7;
    // nur der direkte Vergleich trennt sie.
    const matchups: StandingsMatchup[] = [
      {
        id: "m-AB",
        status: "COMPLETED",
        homeParticipantId: "A",
        awayParticipantId: "B",
        results: [makeResult("A", 96, 3.7, 7.7), makeResult("B", 94, 5.0, 9.0)],
      },
      {
        id: "m-BC",
        status: "COMPLETED",
        homeParticipantId: "B",
        awayParticipantId: "C",
        results: [makeResult("B", 96, 3.7, 7.7), makeResult("C", 90, 8.0, 18.0)],
      },
    ]
    const rows = calculateStandings([pA, pB, pC], matchups)
    expect(rows.map((r) => r.participantId)).toEqual(["A", "B", "C"])
    expect(rows.map((r) => r.bestRingteiler)).toEqual([7.7, 7.7, 18.0])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3])
  })
})

describe("hasLeagueResult", () => {
  it("zählt gespielte Duelle und Freilose als Ergebnis", () => {
    expect(hasLeagueResult({ played: 0, byes: 0 })).toBe(false)
    expect(hasLeagueResult({ played: 0, byes: 1 })).toBe(true)
    expect(hasLeagueResult({ played: 2, byes: 0 })).toBe(true)
  })
})

describe("calculateStandings – feste Disziplin, jede Wertung", () => {
  // Vier Teilnehmer, eine Runde. Gleiche Ringe in A–B, gleicher Ringteiler in B–E, zwei Paarungen ganz gleich.
  const pE: StandingsParticipant = { id: "E", firstName: "Eva", lastName: "Berg", withdrawn: false }
  const duel = (
    id: string,
    home: [string, number, number, number],
    away: [string, number, number, number]
  ): StandingsMatchup => ({
    id,
    status: "COMPLETED",
    homeParticipantId: home[0],
    awayParticipantId: away[0],
    results: [makeResult(...home), makeResult(...away)],
  })
  const matchups = [
    duel("m1", ["A", 96, 10, 14], ["B", 96, 14, 18]),
    duel("m2", ["A", 94, 30, 36], ["C", 97, 40, 43]),
    duel("m3", ["A", 95, 20, 25], ["E", 95, 20, 25]),
    duel("m4", ["B", 98, 50, 52], ["C", 96, 46, 50]),
    duel("m5", ["B", 93, 8, 15], ["E", 94, 9, 15]),
    duel("m6", ["C", 95, 12, 17], ["E", 95, 12, 17]),
  ]
  const table = (mode: "RINGTEILER" | "RINGS" | "TEILER") =>
    calculateStandings([pA, pB, pC, pE], matchups, mode).map((r) => [
      r.participantId,
      r.points,
      r.rank,
      r.bestRingteiler,
      r.bestRings,
    ])

  it("Ringteiler: kleinerer Ringteiler, bei gleichem mehr Ringe", () => {
    expect(table("RINGTEILER")).toEqual([
      ["A", 5, 1, 14, 96],
      ["E", 4, 2, 15, 95],
      ["C", 3, 3, 17, 97],
      ["B", 0, 4, 15, 98],
    ])
  })

  it("Ringe: mehr Ringe, bei gleichen der kleinere Teiler; Punktgleiche trennt der direkte Vergleich", () => {
    expect(table("RINGS")).toEqual([
      ["E", 4, 1, 15, 95],
      ["C", 3, 2, 17, 97],
      ["A", 3, 3, 14, 96],
      ["B", 2, 4, 15, 98],
    ])
  })

  it("Teiler: kleinerer Teiler, bei gleichem mehr Ringe", () => {
    expect(table("TEILER")).toEqual([
      ["A", 5, 1, 14, 96],
      ["C", 3, 2, 17, 97],
      ["B", 2, 3, 15, 98],
      ["E", 2, 4, 15, 95],
    ])
  })
})

describe("calculateStandings – gemischte Liga nach Teiler", () => {
  // A schießt Luftpistole (Faktor 0,333): Teiler 90 zählt wie 30,0. B, C und D schießen Luftgewehr (Faktor 1).
  const pDActive: StandingsParticipant = { ...pD, withdrawn: false }
  const lp = (rings: number, teiler: number) =>
    makeResult("A", rings, teiler, Math.round((100 - rings + teiler / 3) * 10) / 10, teiler / 3)
  const lg = (id: string, rings: number, teiler: number) =>
    makeResult(id, rings, teiler, 100 - rings + teiler)
  const pairing = (id: string, home: string, away: string, results: StandingsMatchup["results"]) =>
    ({
      id,
      status: "COMPLETED",
      homeParticipantId: home,
      awayParticipantId: away,
      results,
    }) as const

  it("vergleicht den korrigierten Teiler, im Duell und im direkten Vergleich", () => {
    const matchups: StandingsMatchup[] = [
      pairing("m1", "A", "B", [lp(95, 90), lg("B", 95, 35)]),
      pairing("m2", "A", "D", [lp(95, 90), lg("D", 95, 50)]),
      pairing("m3", "C", "A", [lg("C", 95, 20), lp(95, 90)]),
      pairing("m4", "B", "D", [lg("B", 95, 35), lg("D", 95, 50)]),
      pairing("m5", "B", "C", [lg("B", 95, 10), lg("C", 95, 20)]),
      pairing("m6", "C", "D", [lg("C", 95, 20), lg("D", 95, 50)]),
    ]
    // korrigiert: A schlägt B und D. A, B und C haben je 4 Punkte und untereinander je einen Sieg; der beste
    // Ringteiler ordnet sie (B 15, C 25, A 35). Nach dem Teiler vom Ausdruck verlöre A alle drei.
    const rows = calculateStandings([pA, pB, pC, pDActive], matchups, "TEILER")
    expect(rows.map((r) => [r.participantId, r.points])).toEqual([
      ["B", 4],
      ["C", 4],
      ["A", 4],
      ["D", 0],
    ])
  })
  it("der direkte Vergleich zählt nach dem korrigierten Teiler, nicht der beste Ringteiler", () => {
    const matchups: StandingsMatchup[] = [
      pairing("m1", "A", "B", [lp(95, 90), lg("B", 95, 35)]),
      pairing("m2", "A", "C", [lp(95, 90), lg("C", 95, 10)]),
      pairing("m3", "A", "D", [lp(95, 90), lg("D", 95, 20)]),
      pairing("m4", "B", "C", [lg("B", 95, 35), lg("C", 95, 10)]),
      pairing("m5", "B", "D", [lg("B", 95, 5), lg("D", 95, 20)]),
      pairing("m6", "C", "D", [lg("C", 95, 10), lg("D", 95, 8)]),
    ]
    // A und B haben je 2 Punkte. A hat B geschlagen (korrigiert 30,0 gegen 35), B hat den besseren Ringteiler (10).
    const rows = calculateStandings([pA, pB, pC, pDActive], matchups, "TEILER")
    expect(rows.map((r) => [r.participantId, r.points])).toEqual([
      ["D", 4],
      ["C", 4],
      ["A", 2],
      ["B", 2],
    ])
  })
})
