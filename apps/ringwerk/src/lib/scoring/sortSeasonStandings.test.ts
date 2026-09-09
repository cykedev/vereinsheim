import { describe, it, expect } from "vitest"
import type { SeasonStandingsEntry } from "./calculateSeasonStandings"
import {
  resolveSeasonSort,
  isAlternatingSort,
  isPodiumRank,
  metricAppearance,
  sortSeasonStandings,
  type ResolvedSeasonSort,
} from "./sortSeasonStandings"

function makeEntry(
  participantName: string,
  opts: {
    rings?: number | null
    teiler?: number | null
    ringteiler?: number | null
    meetsMinSeries?: boolean
  } = {}
): SeasonStandingsEntry {
  const { rings = null, teiler = null, ringteiler = null, meetsMinSeries = true } = opts
  return {
    participantId: participantName,
    participantName,
    seriesCount: rings === null ? 0 : 2,
    meetsMinSeries,
    bestRings: rings,
    bestRingsScoringType: rings === null ? null : "WHOLE",
    bestRings_rank: null,
    bestCorrectedTeiler: teiler,
    bestTeiler_rank: null,
    bestRingteiler: ringteiler,
    bestRingteiler_rank: null,
  }
}

/** Das Fixture aus dem Plan: disjunkte Bestwerte, damit jede Metrik eine andere Reihenfolge ergibt. */
function planFixture(): SeasonStandingsEntry[] {
  return [
    makeEntry("A", { rings: 98, teiler: 12.0, ringteiler: 14.0 }),
    makeEntry("B", { rings: 92, teiler: 3.5, ringteiler: 11.5 }),
    makeEntry("C", { rings: 96, teiler: 7.0, ringteiler: 11.0 }),
    makeEntry("D", { rings: 90, teiler: 9.5, ringteiler: 19.5 }),
  ]
}

const names = (entries: { participantName: string }[]) => entries.map((e) => e.participantName)

describe("resolveSeasonSort", () => {
  it("leitet die klassische Sortierung aus dem Wertungsmodus ab", () => {
    expect(resolveSeasonSort("RINGS", null)).toBe("rings")
    expect(resolveSeasonSort("RINGS_DECIMAL", null)).toBe("rings")
    expect(resolveSeasonSort("TEILER", null)).toBe("teiler")
    expect(resolveSeasonSort("RINGTEILER", null)).toBe("ringteiler")
  })

  it("fällt für nicht saison-taugliche Modi auf Ringteiler zurück", () => {
    expect(resolveSeasonSort("DECIMAL_REST", null)).toBe("ringteiler")
    expect(resolveSeasonSort("TARGET_ABSOLUTE", null)).toBe("ringteiler")
  })

  it("lässt seasonSortMode über den Wertungsmodus gewinnen", () => {
    expect(resolveSeasonSort("RINGS", "ALT_TEILER_FIRST")).toBe("alt-teiler")
    expect(resolveSeasonSort("TEILER", "ALT_RINGS_FIRST")).toBe("alt-rings")
  })

  it("erkennt die alternierenden Sortierungen", () => {
    expect(isAlternatingSort("alt-rings")).toBe(true)
    expect(isAlternatingSort("alt-teiler")).toBe(true)
    expect(isAlternatingSort("rings")).toBe(false)
    expect(isAlternatingSort("teiler")).toBe(false)
    expect(isAlternatingSort("ringteiler")).toBe(false)
  })
})

describe("sortSeasonStandings — klassische Modi", () => {
  it("sortiert Ringe absteigend", () => {
    expect(names(sortSeasonStandings(planFixture(), "rings"))).toEqual(["A", "C", "B", "D"])
  })

  it("sortiert den korrigierten Teiler aufsteigend", () => {
    expect(names(sortSeasonStandings(planFixture(), "teiler"))).toEqual(["B", "C", "D", "A"])
  })

  it("sortiert den Ringteiler aufsteigend", () => {
    expect(names(sortSeasonStandings(planFixture(), "ringteiler"))).toEqual(["C", "B", "A", "D"])
  })

  it("setzt alternatingBy in den klassischen Modi nicht", () => {
    for (const entry of sortSeasonStandings(planFixture(), "rings")) {
      expect(entry.alternatingBy).toBeNull()
    }
  })

  it("stellt Qualifizierte vor Nicht-Qualifizierte, auch bei besserem Wert", () => {
    const entries = [
      makeEntry("Schwach", { rings: 80, teiler: 30.0, ringteiler: 50.0 }),
      makeEntry("Stark", { rings: 100, teiler: 1.0, ringteiler: 1.0, meetsMinSeries: false }),
    ]
    expect(names(sortSeasonStandings(entries, "rings"))).toEqual(["Schwach", "Stark"])
    expect(names(sortSeasonStandings(entries, "teiler"))).toEqual(["Schwach", "Stark"])
  })

  it("lässt bei Wertgleichheit die eingehende Reihenfolge stehen (stabil)", () => {
    // Anders als der alternierende Zweig greift hier KEIN Namens-Tiebreak: die eingehende
    // Ordnung kommt aus calculateSeasonStandings (Ringteiler aufsteigend), und dieses
    // sportliche Kriterium ist bei gleichen Ringen aussagekräftiger als der Nachname.
    const entries = [
      makeEntry("Zeta", { rings: 95, teiler: 5.0, ringteiler: 10.0 }),
      makeEntry("Alpha", { rings: 95, teiler: 5.0, ringteiler: 12.0 }),
    ]
    expect(names(sortSeasonStandings(entries, "rings"))).toEqual(["Zeta", "Alpha"])
    expect(names(sortSeasonStandings(entries, "teiler"))).toEqual(["Zeta", "Alpha"])
  })

  it("stellt Teilnehmer ohne Serie ans Ende, alphabetisch", () => {
    const entries = [
      makeEntry("Zeta"),
      makeEntry("Mitte", { rings: 90, teiler: 9.0, ringteiler: 19.0 }),
      makeEntry("Alpha"),
    ]
    expect(names(sortSeasonStandings(entries, "rings"))).toEqual(["Mitte", "Alpha", "Zeta"])
  })
})

describe("sortSeasonStandings — alternierend", () => {
  it("beginnt bei alt-teiler mit dem besten Teiler und wechselt dann", () => {
    const result = sortSeasonStandings(planFixture(), "alt-teiler")
    // bester Teiler (B 3,5) → beste Ringe (A 98) → zweitbester Teiler (C 7,0) → Rest (D)
    expect(names(result)).toEqual(["B", "A", "C", "D"])
    expect(result.map((e) => e.alternatingBy)).toEqual(["teiler", "rings", "teiler", "rings"])
  })

  it("beginnt bei alt-rings mit den besten Ringen und wechselt dann", () => {
    const result = sortSeasonStandings(planFixture(), "alt-rings")
    // beste Ringe (A 98) → bester Teiler (B 3,5) → zweitbeste Ringe (C 96) → Rest (D)
    expect(names(result)).toEqual(["A", "B", "C", "D"])
    expect(result.map((e) => e.alternatingBy)).toEqual(["rings", "teiler", "rings", "teiler"])
  })

  it("platziert einen in beiden Metriken Besten nur einmal — auf dem ersten Platz", () => {
    const entries = [
      makeEntry("Beides", { rings: 100, teiler: 1.0, ringteiler: 1.0 }),
      makeEntry("Ringe2", { rings: 95, teiler: 5.0, ringteiler: 10.0 }),
      makeEntry("Teiler2", { rings: 90, teiler: 2.0, ringteiler: 12.0 }),
    ]
    const result = sortSeasonStandings(entries, "alt-teiler")
    // Platz 2 ist ein Ringe-Platz → Ringe2, nicht der zweitbeste Teiler
    expect(names(result)).toEqual(["Beides", "Ringe2", "Teiler2"])
    expect(result.map((e) => e.alternatingBy)).toEqual(["teiler", "rings", "teiler"])
  })

  it("füllt bei ungerader Anzahl den letzten Platz mit dem Rest", () => {
    const entries = [
      makeEntry("A", { rings: 98, teiler: 12.0, ringteiler: 14.0 }),
      makeEntry("B", { rings: 92, teiler: 3.5, ringteiler: 11.5 }),
      makeEntry("C", { rings: 96, teiler: 7.0, ringteiler: 11.0 }),
    ]
    const result = sortSeasonStandings(entries, "alt-teiler")
    expect(names(result)).toEqual(["B", "A", "C"])
    expect(result[2].alternatingBy).toBe("teiler")
  })

  it("entscheidet Gleichstand in einer Metrik alphabetisch", () => {
    const entries = [
      makeEntry("Beta", { rings: 90, teiler: 5.0, ringteiler: 15.0 }),
      makeEntry("Alpha", { rings: 90, teiler: 5.0, ringteiler: 15.0 }),
    ]
    const result = sortSeasonStandings(entries, "alt-teiler")
    expect(names(result)).toEqual(["Alpha", "Beta"])
    expect(result.map((e) => e.alternatingBy)).toEqual(["teiler", "rings"])
  })

  it("alterniert innerhalb der Qualifizierten und der Nicht-Qualifizierten getrennt", () => {
    const entries = [
      ...planFixture(),
      makeEntry("NQ-Ringe", { rings: 109, teiler: 20.0, ringteiler: 21.0, meetsMinSeries: false }),
      makeEntry("NQ-Teiler", { rings: 70, teiler: 0.5, ringteiler: 30.5, meetsMinSeries: false }),
    ]
    const result = sortSeasonStandings(entries, "alt-teiler")
    expect(names(result)).toEqual(["B", "A", "C", "D", "NQ-Teiler", "NQ-Ringe"])
    expect(result.slice(4).map((e) => e.alternatingBy)).toEqual(["teiler", "rings"])
  })

  it("stellt Teilnehmer ohne Serie ans Ende, alphabetisch und ohne Kriterium", () => {
    const entries = [makeEntry("Zeta"), ...planFixture(), makeEntry("Alpha")]
    const result = sortSeasonStandings(entries, "alt-rings")
    expect(names(result)).toEqual(["A", "B", "C", "D", "Alpha", "Zeta"])
    expect(result[4].alternatingBy).toBeNull()
    expect(result[5].alternatingBy).toBeNull()
  })
})

describe("sortSeasonStandings — Invarianten", () => {
  const allSorts: ResolvedSeasonSort[] = [
    "rings",
    "teiler",
    "ringteiler",
    "alt-rings",
    "alt-teiler",
  ]

  const mixed = (): SeasonStandingsEntry[] => [
    makeEntry("A", { rings: 98, teiler: 12.0, ringteiler: 14.0 }),
    makeEntry("B", { rings: 92, teiler: 3.5, ringteiler: 11.5 }),
    makeEntry("C", { rings: 96, teiler: 7.0, ringteiler: 11.0 }),
    makeEntry("D", { rings: 90, teiler: 9.5, ringteiler: 19.5, meetsMinSeries: false }),
    makeEntry("E", { rings: 96, teiler: 7.0, ringteiler: 11.0 }),
    makeEntry("F"),
  ]

  it.each(allSorts)("verliert und dupliziert in '%s' keinen Teilnehmer", (sort) => {
    const input = mixed()
    const result = sortSeasonStandings(input, sort)
    expect(result).toHaveLength(input.length)
    expect(new Set(result.map((e) => e.participantId)).size).toBe(input.length)
  })

  it.each(allSorts)("verändert die Eingabeliste in '%s' nicht", (sort) => {
    const input = mixed()
    const before = names(input)
    sortSeasonStandings(input, sort)
    expect(names(input)).toEqual(before)
  })

  it.each(allSorts)("lässt die Einzelränge in '%s' unangetastet", (sort) => {
    const input = mixed().map((e) => ({ ...e, bestRings_rank: 3, bestTeiler_rank: 2 }))
    for (const entry of sortSeasonStandings(input, sort)) {
      expect(entry.bestRings_rank).toBe(3)
      expect(entry.bestTeiler_rank).toBe(2)
    }
  })
})

describe("Darstellungsregeln (geteilt von Tabelle und PDF)", () => {
  it("zählt nur die Podiumsplätze als Inline-Platzierung", () => {
    expect(isPodiumRank(1)).toBe(true)
    expect(isPodiumRank(3)).toBe(true)
    expect(isPodiumRank(4)).toBe(false)
    expect(isPodiumRank(null)).toBe(false)
  })

  it("betont in den alternierenden Modi genau die maßgebliche Metrik", () => {
    const [first, second] = sortSeasonStandings(planFixture(), "alt-teiler")
    expect(first.alternatingBy).toBe("teiler")
    expect(metricAppearance(first, "teiler")).toBe("emphasized")
    expect(metricAppearance(first, "rings")).toBe("muted")
    expect(metricAppearance(first, "ringteiler")).toBe("muted")
    expect(second.alternatingBy).toBe("rings")
    expect(metricAppearance(second, "rings")).toBe("emphasized")
    expect(metricAppearance(second, "teiler")).toBe("muted")
  })

  it("lässt die Darstellung in den klassischen Modi unverändert", () => {
    for (const entry of sortSeasonStandings(planFixture(), "ringteiler")) {
      expect(metricAppearance(entry, "rings")).toBe("default")
      expect(metricAppearance(entry, "teiler")).toBe("default")
      expect(metricAppearance(entry, "ringteiler")).toBe("default")
    }
  })
})
