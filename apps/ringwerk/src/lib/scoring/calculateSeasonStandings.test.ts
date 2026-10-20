import { describe, it, expect } from "vitest"
import {
  calculateSeasonStandings,
  offersMinSeriesExemption,
  requiredSeries,
} from "./calculateSeasonStandings"
import { seasonPositions, sortSeasonStandings } from "./sortSeasonStandings"
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
      expect(p2.meetsMinSeries).toBe(false)
      // Niemand ist gewertet → niemand traegt einen Metrik-Rang
      expect(p1.bestRings_rank).toBeNull()
      expect(p2.bestRings_rank).toBeNull()
    })

    it("vergibt Metrik-Ränge nur an gewertete Teilnehmer", () => {
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

      // p2 hat den besseren Wert (98 > 95), ist aber unter minSeries → kein Rang.
      // Sonst hielte eine ausgegraute Zeile die 1 und p1 waere trotz Wertung nur Zweiter.
      expect(p1.meetsMinSeries).toBe(true)
      expect(p1.bestRings_rank).toBe(1)
      expect(p2.meetsMinSeries).toBe(false)
      expect(p2.bestRings_rank).toBeNull()
      expect(p2.bestTeiler_rank).toBeNull()
      expect(p2.bestRingteiler_rank).toBeNull()
      // Der Wert selbst bleibt sichtbar — nur der Rang faellt weg
      expect(p2.bestRings).toBe(98)
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

  describe("Ohne Mindestzahl (Ausnahme an der Einschreibung)", () => {
    it("bietet die Ausnahme nur in einer Saison mit Mindestzahl an", () => {
      expect(offersMinSeriesExemption({ type: "SEASON", minSeries: 20 })).toBe(true)
      expect(offersMinSeriesExemption({ type: "SEASON", minSeries: null })).toBe(false)
      // bei einer Mindestzahl von 1 änderte die Ausnahme nichts
      expect(offersMinSeriesExemption({ type: "SEASON", minSeries: 1 })).toBe(false)
      expect(offersMinSeriesExemption({ type: "EVENT", minSeries: 20 })).toBe(false)
      expect(offersMinSeriesExemption({ type: "LEAGUE", minSeries: null })).toBe(false)
    })

    it("liefert die Mindestzahl je Zeile: keine, 1 mit Ausnahme, sonst die des Wettbewerbs", () => {
      expect(requiredSeries(null, false)).toBeNull()
      expect(requiredSeries(null, true)).toBeNull()
      expect(requiredSeries(20, false)).toBe(20)
      expect(requiredSeries(20, true)).toBe(1)
      // nie strenger als die Saison selbst
      expect(requiredSeries(0, true)).toBe(0)
    })

    // Die Ausnahme hat den besten Wert. Würde sie ignoriert, hielte der Gewertete Rang 1 und die
    // Ausnahme keinen Rang. So fällt ein Test, wenn die Ausnahme verloren geht.
    const input = [
      {
        participantId: "gewertet",
        participantName: "Gewertet, Gerd",
        series: Array.from({ length: 3 }, () =>
          makeSeries("gewertet", { rings: 95, teiler: 4.0, ringteiler: 9.0 })
        ),
      },
      {
        participantId: "ausnahme",
        participantName: "Ausnahme, Anna",
        exemptFromMinSeries: true,
        series: [makeSeries("ausnahme", { rings: 98, teiler: 2.5, ringteiler: 4.5 })],
      },
      {
        participantId: "ausnahme-leer",
        participantName: "Leer, Lea",
        exemptFromMinSeries: true,
        series: [],
      },
      {
        participantId: "zu-wenig",
        participantName: "Wenig, Willi",
        series: [makeSeries("zu-wenig", { rings: 99, teiler: 1.0, ringteiler: 2.0 })],
      },
    ]

    it("wertet die Ausnahme ab der ersten Serie mit Rang", () => {
      const result = calculateSeasonStandings(input, 3)
      const byId = (id: string) => result.find((e) => e.participantId === id)!

      expect(byId("ausnahme").requiredSeries).toBe(1)
      expect(byId("ausnahme").meetsMinSeries).toBe(true)
      expect(byId("ausnahme").bestRings_rank).toBe(1)
      expect(byId("ausnahme").bestTeiler_rank).toBe(1)
      expect(byId("ausnahme").bestRingteiler_rank).toBe(1)
      expect(byId("gewertet").requiredSeries).toBe(3)
      expect(byId("gewertet").bestRings_rank).toBe(2)
    })

    it("lässt die Ausnahme ohne Serie und alle anderen unter der Mindestzahl ohne Rang", () => {
      const result = calculateSeasonStandings(input, 3)
      const byId = (id: string) => result.find((e) => e.participantId === id)!

      expect(byId("ausnahme-leer").requiredSeries).toBe(1)
      expect(byId("ausnahme-leer").meetsMinSeries).toBe(false)
      expect(byId("ausnahme-leer").bestRings_rank).toBeNull()
      expect(byId("zu-wenig").requiredSeries).toBe(3)
      expect(byId("zu-wenig").meetsMinSeries).toBe(false)
      expect(byId("zu-wenig").bestRings_rank).toBeNull()
    })

    it("ändert ohne Mindestzahl nichts", () => {
      const result = calculateSeasonStandings(input, null)
      for (const entry of result) expect(entry.requiredSeries).toBeNull()
      expect(result.find((e) => e.participantId === "zu-wenig")!.bestRings_rank).toBe(1)
      expect(result.find((e) => e.participantId === "ausnahme")!.bestRings_rank).toBe(2)
    })

    it.each(["ringteiler", "alt-rings"] as const)(
      "stellt die Ausnahme mit Serie in den oberen Block (%s)",
      (sort) => {
        const sorted = sortSeasonStandings(calculateSeasonStandings(input, 3), sort)
        expect(sorted.map((e) => e.participantId)).toEqual([
          "ausnahme",
          "gewertet",
          "zu-wenig",
          "ausnahme-leer",
        ])
        expect(seasonPositions(sorted, sort)).toEqual([1, 2, 3, 4])
      }
    )

    it("behandelt eine Zeile ohne Angabe wie ohne Ausnahme", () => {
      const result = calculateSeasonStandings(
        [
          {
            participantId: "p1",
            participantName: "Müller, Max",
            series: [makeSeries("p1", { rings: 96, teiler: 3.0, ringteiler: 7.0 })],
          },
        ],
        2
      )
      expect(result[0].requiredSeries).toBe(2)
      expect(result[0].meetsMinSeries).toBe(false)
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

  describe("Ablesbarkeit der alternierenden Reihenfolge", () => {
    // Fixture wie im Validierungs-Datensatz: fuenf gewertete Schuetzen mit disjunkten Bestwerten
    // plus einer, der die Mindestserien NICHT erreicht, aber die besten Werte hat.
    function fixture() {
      const two = (id: string, rings: number, teiler: number, ringteiler: number) => ({
        participantId: id,
        participantName: id,
        series: [
          makeSeries(id, { rings, teiler, ringteiler }),
          makeSeries(id, { rings: rings - 12, teiler: teiler + 15, ringteiler: ringteiler + 27 }),
        ],
      })
      return [
        two("Anton", 98, 12.0, 14.0),
        two("Berta", 92, 3.5, 11.5),
        two("Caesar", 96, 7.0, 11.0),
        two("Dora", 90, 9.5, 19.5),
        two("Faktor", 104, 7.2, 12.2),
        // nur eine Serie -> nicht gewertet, obwohl in beiden Metriken top
        {
          participantId: "Emil",
          participantName: "Emil",
          series: [makeSeries("Emil", { rings: 100, teiler: 0.5, ringteiler: 0.5 })],
        },
      ]
    }

    it("liest sich als bester/bester, zweitbester/zweitbester — Unqualifizierte halten keine Ränge", () => {
      const sorted = sortSeasonStandings(calculateSeasonStandings(fixture(), 2), "alt-rings")

      expect(sorted.map((e) => e.participantName)).toEqual([
        "Faktor",
        "Berta",
        "Anton",
        "Caesar",
        "Dora",
        "Emil",
      ])
      // Der Rang der jeweils maßgeblichen Metrik: 1, 1, 2, 2 — ohne Lücke
      expect(sorted[0].bestRings_rank).toBe(1)
      expect(sorted[1].bestTeiler_rank).toBe(1)
      expect(sorted[2].bestRings_rank).toBe(2)
      expect(sorted[3].bestTeiler_rank).toBe(2)
      // Der nicht gewertete Schütze steht hinten und trägt keinen Rang
      const emil = sorted[5]
      expect(emil.meetsMinSeries).toBe(false)
      expect(emil.bestRings_rank).toBeNull()
      expect(emil.bestTeiler_rank).toBeNull()
    })

    it("ein Sprung bleibt möglich, wenn der Nächstplatzierte schon über die andere Metrik dran war", () => {
      // Ohne "Faktor": Caesar ist zweitbeste Ringe UND zweitbester Teiler. Er wird über die Ringe
      // platziert, also faellt der naechste Teiler-Platz an Dora — Teiler-Rang 3 statt 2.
      // Folge der Regel "jeder Schuetze genau einmal", kein Rechenfehler.
      const withoutFaktor = fixture().filter((p) => p.participantId !== "Faktor")
      const sorted = sortSeasonStandings(calculateSeasonStandings(withoutFaktor, 2), "alt-rings")

      expect(sorted.map((e) => e.participantName)).toEqual([
        "Anton",
        "Berta",
        "Caesar",
        "Dora",
        "Emil",
      ])
      expect(sorted[0].bestRings_rank).toBe(1)
      expect(sorted[1].bestTeiler_rank).toBe(1)
      expect(sorted[2].bestRings_rank).toBe(2)
      expect(sorted[3].bestTeiler_rank).toBe(3)
    })
  })
})
