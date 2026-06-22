import { describe, it, expect } from "vitest"
import { rankEventParticipants, rankEventTeams } from "./rankEventParticipants"
import type { EventSeriesItem } from "@/lib/series/types"

function makeSeries(
  overrides: Partial<EventSeriesItem> & {
    participantId: string
    rings: number
    teiler: number
    ringteiler?: number
  }
): EventSeriesItem {
  return {
    id: overrides.id ?? overrides.participantId + "-series",
    participantId: overrides.participantId,
    competitionParticipantId: overrides.competitionParticipantId ?? null,
    disciplineId: overrides.disciplineId ?? "disc-1",
    discipline: overrides.discipline ?? {
      name: "LG",
      teilerFaktor: 1.0,
      scoringType: "WHOLE" as const,
    },
    participant: overrides.participant ?? {
      id: overrides.participantId,
      firstName: overrides.participantId,
      lastName: "Müller",
    },
    isGuest: overrides.isGuest ?? false,
    teamNumber: overrides.teamNumber ?? null,
    rings: overrides.rings,
    teiler: overrides.teiler,
    ringteiler: overrides.ringteiler ?? 100 - overrides.rings + overrides.teiler * 1.0, // default assumes WHOLE (max 100) — override explicitly for DECIMAL tests
    shots: overrides.shots ?? [],
    shotCount: 10,
    sessionDate: new Date("2026-03-17"),
  }
}

const BASE_CONFIG = {
  scoringMode: "RINGTEILER" as const,
  targetValue: null,
  targetValueType: null,
  discipline: { scoringType: "WHOLE" as const },
  competitionDisciplineId: null,
}

describe("rankEventParticipants", () => {
  it("leere Liste zurückgeben wenn keine Serien", () => {
    const result = rankEventParticipants([], BASE_CONFIG)
    expect(result).toEqual([])
  })

  it("RINGTEILER: niedrigster Ringteiler gewinnt", () => {
    const series = [
      makeSeries({ participantId: "A", rings: 90, teiler: 15.0, ringteiler: 25.0 }),
      makeSeries({ participantId: "B", rings: 95, teiler: 5.0, ringteiler: 10.0 }),
      makeSeries({ participantId: "C", rings: 88, teiler: 8.0, ringteiler: 20.0 }),
    ]
    const result = rankEventParticipants(series, BASE_CONFIG)
    expect(result[0].participantId).toBe("B") // Ringteiler 10.0
    expect(result[1].participantId).toBe("C") // Ringteiler 20.0
    expect(result[2].participantId).toBe("A") // Ringteiler 25.0
    expect(result[0].rank).toBe(1)
    expect(result[2].rank).toBe(3)
  })

  it("RINGS: höchste Ringe gewinnen", () => {
    const series = [
      makeSeries({ participantId: "A", rings: 88, teiler: 5.0 }),
      makeSeries({ participantId: "B", rings: 95, teiler: 20.0 }),
      makeSeries({ participantId: "C", rings: 91, teiler: 10.0 }),
    ]
    const result = rankEventParticipants(series, { ...BASE_CONFIG, scoringMode: "RINGS" })
    expect(result[0].participantId).toBe("B") // 95 Ringe
    expect(result[1].participantId).toBe("C") // 91 Ringe
    expect(result[2].participantId).toBe("A") // 88 Ringe
  })

  it("TEILER: niedrigster korrigierter Teiler gewinnt", () => {
    const series = [
      makeSeries({ participantId: "A", rings: 90, teiler: 3.7 }),
      makeSeries({ participantId: "B", rings: 90, teiler: 5.2 }),
      makeSeries({ participantId: "C", rings: 90, teiler: 2.1 }),
    ]
    const result = rankEventParticipants(series, { ...BASE_CONFIG, scoringMode: "TEILER" })
    expect(result[0].participantId).toBe("C") // Teiler 2.1
    expect(result[1].participantId).toBe("A") // Teiler 3.7
    expect(result[2].participantId).toBe("B") // Teiler 5.2
  })

  it("TEILER: Faktor-Korrektur bei gemischten Disziplinen", () => {
    const series = [
      makeSeries({
        participantId: "LG",
        rings: 90,
        teiler: 10.0,
        discipline: { name: "LG", teilerFaktor: 1.0, scoringType: "WHOLE" as const }, // korrigiert: 10.0
      }),
      makeSeries({
        participantId: "LP",
        rings: 90,
        teiler: 25.0,
        discipline: { name: "LP", teilerFaktor: 0.333, scoringType: "WHOLE" as const }, // korrigiert: 8.325
      }),
    ]
    const result = rankEventParticipants(series, { ...BASE_CONFIG, scoringMode: "TEILER" })
    // LP hat korrigierten Teiler 25 * 0.333 = 8.325 < 10.0
    expect(result[0].participantId).toBe("LP")
    expect(result[1].participantId).toBe("LG")
  })

  it("TARGET_ABSOLUTE: geringste Abweichung vom Zielwert gewinnt", () => {
    const series = [
      makeSeries({ participantId: "A", rings: 95, teiler: 5.0 }), // Abw. 5
      makeSeries({ participantId: "B", rings: 98, teiler: 5.0 }), // Abw. 2
      makeSeries({ participantId: "C", rings: 88, teiler: 5.0 }), // Abw. 12
    ]
    const result = rankEventParticipants(series, {
      ...BASE_CONFIG,
      scoringMode: "TARGET_ABSOLUTE",
      targetValue: 100,
      targetValueType: "RINGS",
    })
    expect(result[0].participantId).toBe("B") // Abweichung 2
    expect(result[1].participantId).toBe("A") // Abweichung 5
    expect(result[2].participantId).toBe("C") // Abweichung 12
  })

  it("TARGET_UNDER: Teilnehmer unter Zielwert vor Teilnehmern drüber", () => {
    // Zielwert 90 Ringe
    const series = [
      makeSeries({ participantId: "A", rings: 92, teiler: 5.0 }), // über Ziel → schlechtere Tier
      makeSeries({ participantId: "B", rings: 89, teiler: 5.0 }), // unter Ziel, Abw. 1
      makeSeries({ participantId: "C", rings: 87, teiler: 5.0 }), // unter Ziel, Abw. 3
      makeSeries({ participantId: "D", rings: 91, teiler: 5.0 }), // über Ziel, Abw. 1
    ]
    const result = rankEventParticipants(series, {
      ...BASE_CONFIG,
      scoringMode: "TARGET_UNDER",
      targetValue: 90,
      targetValueType: "RINGS",
    })
    // Erst unter-Ziel (B, C): B Abw. 1, C Abw. 3
    // Dann über-Ziel (D, A): D Abw. 1, A Abw. 2
    expect(result[0].participantId).toBe("B")
    expect(result[1].participantId).toBe("C")
    expect(result[2].participantId).toBe("D")
    expect(result[3].participantId).toBe("A")
  })

  it("Rangnummern sind korrekt 1-basiert", () => {
    const series = [
      makeSeries({ participantId: "A", rings: 90, teiler: 5.0, ringteiler: 15.0 }),
      makeSeries({ participantId: "B", rings: 95, teiler: 3.0, ringteiler: 8.0 }),
    ]
    const result = rankEventParticipants(series, BASE_CONFIG)
    expect(result.find((r) => r.participantId === "B")?.rank).toBe(1)
    expect(result.find((r) => r.participantId === "A")?.rank).toBe(2)
  })

  it("Teilnehmername korrekt zusammengesetzt", () => {
    const series = [
      makeSeries({
        participantId: "x",
        rings: 90,
        teiler: 5.0,
        participant: { id: "x", firstName: "Hans", lastName: "Gruber" },
      }),
    ]
    const result = rankEventParticipants(series, BASE_CONFIG)
    expect(result[0].participantName).toBe("Hans Gruber")
  })

  it("RINGTEILER: gemischter Event — DECIMAL-Disziplin verwendet maxRings=109", () => {
    // Kranzl-2026-Szenario: LP (WHOLE) vs LPA (DECIMAL)
    // Korrekt: LPA-RT = 109 − 100 + 6 = 15.0, LP-RT = 100 − 99 + 11.3 = 12.3
    // → LP gewinnt (12.3 < 15.0)
    const series = [
      makeSeries({
        participantId: "LPA",
        rings: 100,
        teiler: 6.0,
        ringteiler: 15.0,
        discipline: {
          name: "Luftpistole Auflage",
          teilerFaktor: 1.0,
          scoringType: "DECIMAL" as const,
        },
      }),
      makeSeries({
        participantId: "LP",
        rings: 99,
        teiler: 11.3,
        ringteiler: 12.3,
        discipline: { name: "Luftpistole", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
      }),
    ]
    const mixedConfig = {
      scoringMode: "RINGTEILER" as const,
      targetValue: null,
      targetValueType: null,
      competitionDisciplineId: null,
      discipline: null, // Gemischt — kein Competition-Level-scoringType
    }
    const result = rankEventParticipants(series, mixedConfig)
    // LP (RT 12.3) muss vor LPA (RT 15.0) liegen
    expect(result[0].participantId).toBe("LP")
    expect(result[1].participantId).toBe("LPA")
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
  })

  it("enthält disciplineScoringType aus der Disziplin der Serie", () => {
    const series = [
      makeSeries({
        participantId: "p1",
        rings: 96,
        teiler: 3.7,
        discipline: { name: "LG", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
      }),
      makeSeries({
        participantId: "p2",
        rings: 104.5,
        teiler: 2.1,
        discipline: { name: "LGA", teilerFaktor: 1.8, scoringType: "DECIMAL" as const },
      }),
    ]
    const result = rankEventParticipants(series, BASE_CONFIG)
    const p1 = result.find((e) => e.participantId === "p1")!
    const p2 = result.find((e) => e.participantId === "p2")!
    expect(p1.disciplineScoringType).toBe("WHOLE")
    expect(p2.disciplineScoringType).toBe("DECIMAL")
  })

  it("Double-Enrollment: gleicher Teilnehmer in zwei Teams wird separat gerankt", () => {
    // Müller schießt zweimal — einmal für Team 1 (gut), einmal für Team 2 (schwächer)
    const series = [
      makeSeries({
        id: "cp1-series",
        participantId: "mueller",
        competitionParticipantId: "cp-1",
        teamNumber: 1,
        rings: 95,
        teiler: 5.0,
        ringteiler: 10.0,
      }),
      makeSeries({
        id: "cp2-series",
        participantId: "mueller",
        competitionParticipantId: "cp-2",
        teamNumber: 2,
        rings: 88,
        teiler: 12.0,
        ringteiler: 24.0,
      }),
      makeSeries({
        participantId: "schmidt",
        competitionParticipantId: "cp-3",
        teamNumber: 1,
        rings: 91,
        teiler: 8.0,
        ringteiler: 17.0,
      }),
    ]
    const result = rankEventParticipants(series, BASE_CONFIG)
    expect(result).toHaveLength(3)
    // Alle drei Einträge landen in der Rangliste
    const muellerEntries = result.filter((r) => r.participantId === "mueller")
    expect(muellerEntries).toHaveLength(2)
    // Bestes Müller-Ergebnis auf Rang 1
    expect(result[0].seriesId).toBe("cp1-series")
    expect(result[0].rank).toBe(1)
  })
})

describe("rankEventTeams", () => {
  const makeRankedEntry = (
    teamNumber: number,
    participantId: string,
    score: number
  ): import("./rankEventParticipants").EventRankedEntry => ({
    rank: 1,
    seriesId: participantId + "-series",
    competitionParticipantId: null,
    participantId,
    participantName: participantId,
    disciplineName: "LG",
    disciplineScoringType: "WHOLE" as const,
    isGuest: false,
    teamNumber,
    rings: 90,
    teiler: score, // score für einfaches Testen
    correctedTeiler: score,
    ringteiler: score,
    score,
  })

  it("leere Liste wenn keine Serien mit teamNumber", () => {
    const entries = [makeRankedEntry(null as unknown as number, "A", 10)]
    // teamNumber null → kein Team
    const result = rankEventTeams(entries, "SUM", "RINGTEILER")
    expect(result).toEqual([])
  })

  it("SUM: Teamscore ist Summe der Einzel-Scores", () => {
    const entries = [
      makeRankedEntry(1, "A", 10), // Team 1: 10+15 = 25
      makeRankedEntry(1, "B", 15),
      makeRankedEntry(2, "C", 8), // Team 2: 8+9 = 17
      makeRankedEntry(2, "D", 9),
    ]
    const result = rankEventTeams(entries, "SUM", "RINGTEILER")
    expect(result).toHaveLength(2)
    // RINGTEILER ist asc → niedrigerer Score gewinnt
    expect(result[0].teamNumber).toBe(2) // Score 17
    expect(result[1].teamNumber).toBe(1) // Score 25
    expect(result[0].rank).toBe(1)
    expect(result[0].teamScore).toBe(17)
  })

  it("BEST: Teamscore ist bester (niedrigster) Einzel-Score bei asc-Modus", () => {
    const entries = [
      makeRankedEntry(1, "A", 10), // Team 1 best: 10
      makeRankedEntry(1, "B", 20),
      makeRankedEntry(2, "C", 8), // Team 2 best: 8
      makeRankedEntry(2, "D", 15),
    ]
    const result = rankEventTeams(entries, "BEST", "RINGTEILER")
    expect(result[0].teamNumber).toBe(2) // best score 8 < 10
    expect(result[0].teamScore).toBe(8)
    expect(result[1].teamScore).toBe(10)
  })

  it("BEST: bei RINGS-Modus (desc) ist höchste Ringe das Beste", () => {
    const entries = [
      makeRankedEntry(1, "A", 95), // Team 1 best: 95
      makeRankedEntry(1, "B", 80),
      makeRankedEntry(2, "C", 98), // Team 2 best: 98
      makeRankedEntry(2, "D", 70),
    ]
    const result = rankEventTeams(entries, "BEST", "RINGS")
    expect(result[0].teamNumber).toBe(2) // best score 98 > 95
    expect(result[0].teamScore).toBe(98)
  })

  it("Team-Mitglieder korrekt im Ergebnis", () => {
    const entries = [makeRankedEntry(1, "mueller", 10), makeRankedEntry(1, "schmidt", 12)]
    const result = rankEventTeams(entries, "SUM", "RINGTEILER")
    expect(result[0].members).toHaveLength(2)
    const names = result[0].members.map((m) => m.participantId)
    expect(names).toContain("mueller")
    expect(names).toContain("schmidt")
  })
})

describe("rankEventParticipants – Faktor nur bei gemischt", () => {
  const lpSeries = (id: string, teiler: number) =>
    makeSeries({
      participantId: id,
      rings: 90,
      teiler,
      discipline: { name: "LP", teilerFaktor: 0.3333333, scoringType: "WHOLE" as const },
    })

  it("festes Event (disciplineId gesetzt): correctedTeiler OHNE Faktor", () => {
    const result = rankEventParticipants([lpSeries("A", 60)], {
      ...BASE_CONFIG,
      scoringMode: "TEILER",
      competitionDisciplineId: "d-lp",
    })
    expect(result[0].correctedTeiler).toBeCloseTo(60)
    expect(result[0].score).toBeCloseTo(60)
  })

  it("gemischtes Event (disciplineId null): correctedTeiler MIT Faktor", () => {
    const result = rankEventParticipants([lpSeries("A", 60)], {
      ...BASE_CONFIG,
      scoringMode: "TEILER",
      competitionDisciplineId: null,
    })
    expect(result[0].correctedTeiler).toBeCloseTo(20)
  })
})
