import { describe, it, expect } from "vitest"
import { calculateSeasonStandings } from "./calculateSeasonStandings"
import type { SeasonSeriesItem } from "@/lib/series/types"

function makeSeries(
  participantId: string,
  overrides: Partial<SeasonSeriesItem> & { rings: number; teiler: number; ringteiler: number }
): SeasonSeriesItem {
  return {
    id: `series-${Math.random()}`,
    participantId,
    disciplineId: "disc-1",
    discipline: { name: "LP", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
    shotCount: 10,
    sessionDate: new Date("2026-01-15"),
    ...overrides,
  }
}

describe("calculateSeasonStandings", () => {
  describe("Leere Eingaben", () => {
    it("gibt leeres Array zurück wenn keine Teilnehmer", () => {
      expect(calculateSeasonStandings([], null)).toEqual([])
    })

    it("zeigt Teilnehmer ohne Serien ohne Ränge", () => {
      const result = calculateSeasonStandings(
        [{ participantId: "p1", participantName: "Müller, Max", series: [] }],
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].bestRings).toBeNull()
      expect(result[0].bestRings_rank).toBeNull()
    })
  })

  describe("Beste Ringe", () => {
    it("wählt die Serie mit den höchsten Ringen", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", { rings: 94, teiler: 5.0, ringteiler: 11.0 }),
              makeSeries("p1", { rings: 98, teiler: 3.5, ringteiler: 5.5 }),
              makeSeries("p1", { rings: 91, teiler: 8.0, ringteiler: 17.0 }),
            ],
          },
        ],
        null
      )
      expect(result[0].bestRings).toBe(98)
    })

    it("rankt nach besten Ringen absteigend", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [makeSeries("p1", { rings: 95, teiler: 4.0, ringteiler: 9.0 })],
          },
          {
            participantId: "p2",
            participantName: "Huber, Anna",
            series: [makeSeries("p2", { rings: 98, teiler: 3.0, ringteiler: 5.0 })],
          },
          {
            participantId: "p3",
            participantName: "Bauer, Klaus",
            series: [makeSeries("p3", { rings: 92, teiler: 6.0, ringteiler: 14.0 })],
          },
        ],
        null
      )
      const p2 = result.find((e) => e.participantId === "p2")!
      const p1 = result.find((e) => e.participantId === "p1")!
      const p3 = result.find((e) => e.participantId === "p3")!
      expect(p2.bestRings_rank).toBe(1)
      expect(p1.bestRings_rank).toBe(2)
      expect(p3.bestRings_rank).toBe(3)
    })

    it("gleicher Rang bei gleichem Ringwert", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [makeSeries("p1", { rings: 98, teiler: 4.0, ringteiler: 6.0 })],
          },
          {
            participantId: "p2",
            participantName: "Huber, Anna",
            series: [makeSeries("p2", { rings: 98, teiler: 3.5, ringteiler: 5.5 })],
          },
        ],
        null
      )
      expect(result.find((e) => e.participantId === "p1")?.bestRings_rank).toBe(1)
      expect(result.find((e) => e.participantId === "p2")?.bestRings_rank).toBe(1)
    })

    it("gibt scoringType der bestRings-Serie zurück (WHOLE)", () => {
      const series = [
        makeSeries("p1", {
          rings: 92,
          teiler: 5.0,
          ringteiler: 13.0,
          discipline: { name: "LG", teilerFaktor: 1.0, scoringType: "DECIMAL" as const },
        }),
        makeSeries("p1", { rings: 96, teiler: 3.7, ringteiler: 7.7 }), // highest → WHOLE
      ]
      const result = calculateSeasonStandings(
        [{ participantId: "p1", participantName: "Müller, Max", series }],
        null
      )
      expect(result[0].bestRingsScoringType).toBe("WHOLE")
    })

    it("gibt scoringType der bestRings-Serie zurück (DECIMAL)", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", {
                rings: 104.5,
                teiler: 2.1,
                ringteiler: 6.6,
                discipline: { name: "LGA", teilerFaktor: 1.8, scoringType: "DECIMAL" as const },
              }),
            ],
          },
        ],
        null
      )
      expect(result[0].bestRingsScoringType).toBe("DECIMAL")
    })

    it("gibt null zurück wenn keine Serien", () => {
      const result = calculateSeasonStandings(
        [{ participantId: "p1", participantName: "Müller, Max", series: [] }],
        null
      )
      expect(result[0].bestRingsScoringType).toBeNull()
    })
  })

  describe("Bester Teiler (korrigiert)", () => {
    it("wählt den niedrigsten korrigierten Teiler über alle Serien", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", { rings: 94, teiler: 5.0, ringteiler: 11.0 }),
              makeSeries("p1", { rings: 96, teiler: 2.8, ringteiler: 6.8 }),
              makeSeries("p1", { rings: 92, teiler: 8.0, ringteiler: 16.0 }),
            ],
          },
        ],
        null
      )
      // Faktor 1.0 → correctedTeiler = teiler * 1.0
      expect(result[0].bestCorrectedTeiler).toBe(2.8)
    })

    it("wendet Faktor-Korrektur an", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", {
                rings: 96,
                teiler: 3.0,
                ringteiler: 4.0,
                discipline: { name: "LP", teilerFaktor: 0.3333333, scoringType: "WHOLE" as const },
              }),
              makeSeries("p1", {
                rings: 94,
                teiler: 10.0,
                ringteiler: 9.33,
                discipline: { name: "LG", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
              }),
            ],
          },
        ],
        null
      )
      // LP: 3.0 * 0.3333333 ≈ 1.0, LG: 10.0 * 1.0 = 10.0 → LP besser
      expect(result[0].bestCorrectedTeiler).toBeCloseTo(1.0, 4)
    })

    it("bester Teiler und beste Ringe können aus verschiedenen Serien stammen", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", { rings: 98, teiler: 5.0, ringteiler: 7.0 }), // beste Ringe
              makeSeries("p1", { rings: 90, teiler: 1.5, ringteiler: 11.5 }), // bester Teiler
            ],
          },
        ],
        null
      )
      expect(result[0].bestRings).toBe(98)
      expect(result[0].bestCorrectedTeiler).toBe(1.5)
    })
  })

  describe("Bester Ringteiler", () => {
    it("wählt den niedrigsten Ringteiler einer einzelnen Serie", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", { rings: 94, teiler: 5.0, ringteiler: 11.0 }),
              makeSeries("p1", { rings: 98, teiler: 3.5, ringteiler: 5.5 }),
              makeSeries("p1", { rings: 92, teiler: 8.0, ringteiler: 16.0 }),
            ],
          },
        ],
        null
      )
      expect(result[0].bestRingteiler).toBe(5.5)
    })
  })

  describe("Mindestserien-Filter", () => {
    it("markiert Teilnehmer unter minSeries als nicht qualifiziert", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [
              makeSeries("p1", { rings: 96, teiler: 3.0, ringteiler: 7.0 }),
              makeSeries("p1", { rings: 94, teiler: 4.0, ringteiler: 10.0 }),
            ],
          },
          {
            participantId: "p2",
            participantName: "Huber, Anna",
            series: [makeSeries("p2", { rings: 98, teiler: 2.5, ringteiler: 4.5 })],
          },
        ],
        3 // minSeries = 3
      )
      const p1 = result.find((e) => e.participantId === "p1")!
      const p2 = result.find((e) => e.participantId === "p2")!

      expect(p1.meetsMinSeries).toBe(false)
      expect(p1.bestRings_rank).toBe(2) // 96 Ringe → Rang 2
      expect(p2.meetsMinSeries).toBe(false)
      expect(p2.bestRings_rank).toBe(1) // 98 Ringe → Rang 1
    })

    it("gibt Rang an alle Teilnehmer mit Werten, unabhängig von Qualifikation", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: Array.from({ length: 3 }, () =>
              makeSeries("p1", { rings: 95, teiler: 4.0, ringteiler: 9.0 })
            ),
          },
          {
            participantId: "p2",
            participantName: "Huber, Anna",
            series: Array.from({ length: 2 }, () =>
              makeSeries("p2", { rings: 98, teiler: 2.5, ringteiler: 4.5 })
            ),
          },
        ],
        3 // minSeries = 3
      )
      const p1 = result.find((e) => e.participantId === "p1")!
      const p2 = result.find((e) => e.participantId === "p2")!

      expect(p1.meetsMinSeries).toBe(true)
      expect(p1.bestRings_rank).toBe(2) // 95 Ringe → Rang 2 (p2 hat 98)
      expect(p2.meetsMinSeries).toBe(false)
      expect(p2.bestRings_rank).toBe(1) // 98 Ringe → Rang 1 (auch wenn unqualifiziert)
    })

    it("qualifiziert alle wenn minSeries null", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [makeSeries("p1", { rings: 96, teiler: 3.0, ringteiler: 7.0 })],
          },
        ],
        null
      )
      expect(result[0].meetsMinSeries).toBe(true)
      expect(result[0].bestRings_rank).toBe(1)
    })
  })

  describe("Sortierung", () => {
    it("qualifizierte Teilnehmer vor nicht-qualifizierten", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [makeSeries("p1", { rings: 98, teiler: 2.5, ringteiler: 4.5 })],
          },
          {
            participantId: "p2",
            participantName: "Huber, Anna",
            series: Array.from({ length: 3 }, () =>
              makeSeries("p2", { rings: 90, teiler: 8.0, ringteiler: 18.0 })
            ),
          },
        ],
        3
      )
      expect(result[0].participantId).toBe("p2")
      expect(result[1].participantId).toBe("p1")
    })
  })
})

describe("calculateSeasonStandings – Faktor nur bei gemischt", () => {
  const lp = (teiler: number) =>
    makeSeries("p1", {
      rings: 90,
      teiler,
      ringteiler: 30,
      discipline: { name: "LP", teilerFaktor: 0.3333333, scoringType: "WHOLE" as const },
    })

  it("feste Saison-Disziplin: bestCorrectedTeiler OHNE Faktor", () => {
    const result = calculateSeasonStandings(
      [{ participantId: "p1", participantName: "Müller, Max", series: [lp(60)] }],
      null,
      "d-lp"
    )
    expect(result[0].bestCorrectedTeiler).toBeCloseTo(60)
  })

  it("gemischte Saison (disciplineId null): bestCorrectedTeiler MIT Faktor", () => {
    const result = calculateSeasonStandings(
      [{ participantId: "p1", participantName: "Müller, Max", series: [lp(60)] }],
      null,
      null
    )
    expect(result[0].bestCorrectedTeiler).toBeCloseTo(20)
  })
})
