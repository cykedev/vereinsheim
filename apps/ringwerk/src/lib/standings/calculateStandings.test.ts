import { describe, it, expect } from "vitest"
import { calculateStandings } from "./calculateStandings"
import type { StandingsParticipant, StandingsMatchup } from "./calculateStandings"

// Hilfsfunktion: Ergebnis für einen Teilnehmer
function makeResult(participantId: string, rings: number, teiler: number, ringteiler: number) {
  return { participantId, rings, teiler, ringteiler }
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
