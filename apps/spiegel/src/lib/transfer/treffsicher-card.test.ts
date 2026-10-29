import { describe, expect, it } from "vitest"

import { checkDetails } from "@/lib/entered/details"

import {
  disciplineForShots,
  familyForName,
  treffsicherDetails,
  type TreffsicherSessionForCard,
} from "./treffsicher-card"

const ten = (value: string) => Array.from({ length: 10 }, () => value)
const DISCIPLINE = { plannedShots: 40, seriesShots: 10 }

function session(over: Partial<TreffsicherSessionForCard> = {}): TreffsicherSessionForCard {
  return {
    id: "s1",
    dateMs: Date.UTC(2026, 2, 13, 18),
    type: "TRAINING",
    location: null,
    discipline: { name: "Luftpistole", scoringType: "WHOLE", shotsPerSeries: 10 },
    series: [1, 2, 3, 4].map((position) => ({
      position,
      isPractice: false,
      scoreTotal: 90,
      shots: ten("9"),
    })),
    hitLocation: null,
    ...over,
  }
}

describe("treffsicherDetails", () => {
  it("alle Schüsse: Schüsse, Serien-Summen und Gesamtergebnis, ohne Problem in der echten Prüfung", () => {
    const result = treffsicherDetails(session())
    expect(result?.level).toBe("shots")
    expect(result?.shots).toBe(40)
    expect(result?.details.shots).toHaveLength(40)
    expect(result?.details.series).toEqual(
      [1, 2, 3, 4].map((series) => ({ series, shots: 10, rings: 90 }))
    )
    expect(result?.details.total).toEqual({ shots: 40, rings: 360 })
    const checked = checkDetails(result!.details, DISCIPLINE)
    expect(checked.ok).toBe(true)
  })

  it("Zehntel: Schüsse mit Zehnteln und Ring, Summen in Zehnteln", () => {
    const result = treffsicherDetails(
      session({
        discipline: { name: "Luftgewehr", scoringType: "TENTH", shotsPerSeries: 10 },
        series: [1, 2, 3, 4].map((position) => ({
          position,
          isPractice: false,
          scoreTotal: 104.5,
          shots: [...ten("10.4").slice(0, 5), ...ten("10,5").slice(0, 5)],
        })),
      })
    )
    expect(result?.level).toBe("shots")
    expect(result?.details.shots?.[0]).toEqual({ series: 1, ring: 10, decimalTenths: 104 })
    expect(result?.details.series?.[0]).toEqual({ series: 1, shots: 10, decimalTenths: 1045 })
    expect(result?.details.total).toEqual({ shots: 40, decimalTenths: 4180 })
    expect(checkDetails(result!.details, DISCIPLINE).ok).toBe(true)
  })

  it("eine Serie ohne Schüsse: nur Serien-Summen und Gesamtergebnis", () => {
    const base = session()
    const result = treffsicherDetails({
      ...base,
      series: base.series.map((s, i) => (i === 2 ? { ...s, shots: null } : s)),
    })
    expect(result?.level).toBe("series")
    expect(result?.details.shots).toBeUndefined()
    expect(result?.details.series).toHaveLength(4)
    expect(checkDetails(result!.details, DISCIPLINE).ok).toBe(true)
  })

  it("Schüsse, die nicht zum Wert der Serie passen: nur Serien-Summen", () => {
    const base = session()
    const result = treffsicherDetails({
      ...base,
      series: base.series.map((s, i) => (i === 0 ? { ...s, scoreTotal: 91 } : s)),
    })
    expect(result?.level).toBe("series")
    expect(checkDetails(result!.details, DISCIPLINE).ok).toBe(true)
  })

  it("Probeserien als Probe, Wertungsserien neu nummeriert, ohne Wert fehlt das Gesamtergebnis", () => {
    const result = treffsicherDetails(
      session({
        series: [
          { position: 1, isPractice: true, scoreTotal: null, shots: ["8", "9"] },
          { position: 2, isPractice: false, scoreTotal: 90, shots: ten("9") },
          { position: 3, isPractice: false, scoreTotal: null, shots: null },
          { position: 4, isPractice: false, scoreTotal: 100, shots: ten("10") },
        ],
      })
    )
    expect(result?.details.shots?.filter((s) => s.probe)).toEqual([
      { series: null, ring: 8, decimalTenths: null, probe: true },
      { series: null, ring: 9, decimalTenths: null, probe: true },
    ])
    expect(result?.details.series?.map((s) => s.series)).toEqual([1, 2])
    expect(result?.details.total).toBeNull()
    expect(result?.shots).toBe(20)
    expect(checkDetails(result!.details, { plannedShots: 20, seriesShots: 10 }).ok).toBe(true)
  })

  it("Trefferlage links und tief negativ, über die Wertungsschüsse", () => {
    const result = treffsicherDetails(
      session({ hitLocation: { xMm: 1.2, yMm: 0.4, horizontal: "LEFT", vertical: "LOW" } })
    )
    expect(result?.details.center).toEqual({ xUm: -1200, yUm: -400, shots: 40 })
    const right = treffsicherDetails(
      session({ hitLocation: { xMm: 1.2, yMm: 0.4, horizontal: "RIGHT", vertical: "HIGH" } })
    )
    expect(right?.details.center).toEqual({ xUm: 1200, yUm: 400, shots: 40 })
  })

  it("ohne Disziplin oder ohne Wertungsserie mit Wert keine Angaben", () => {
    expect(treffsicherDetails(session({ discipline: null }))).toBeNull()
    expect(
      treffsicherDetails(
        session({ series: [{ position: 1, isPractice: true, scoreTotal: 90, shots: null }] })
      )
    ).toBeNull()
  })
})

describe("familyForName", () => {
  const families = [
    { id: 1, name: "Luftpistole" },
    { id: 2, name: "Luftgewehr" },
  ]
  it("trifft den Namen ohne Groß- und Kleinschreibung und Rand, nur genau einen", () => {
    expect(familyForName(" luftpistole ", families)).toBe(1)
    expect(familyForName("Sportpistole", families)).toBeNull()
    expect(familyForName("Luftgewehr", [...families, { id: 3, name: "LUFTGEWEHR" }])).toBeNull()
  })
})

describe("disciplineForShots", () => {
  it("nimmt die Disziplin mit dieser Schusszahl, bei mehreren die meistgenutzte, gleich oft keine", () => {
    const candidates = [
      { id: 1, plannedShots: 40, ownCards: 3 },
      { id: 2, plannedShots: 60, ownCards: 1 },
      { id: 3, plannedShots: 60, ownCards: 7 },
    ]
    expect(disciplineForShots(candidates, 40)).toBe(1)
    expect(disciplineForShots(candidates, 60)).toBe(3)
    expect(disciplineForShots(candidates, 20)).toBeNull()
    expect(
      disciplineForShots(
        [
          { id: 2, plannedShots: 60, ownCards: 4 },
          { id: 3, plannedShots: 60, ownCards: 4 },
        ],
        60
      )
    ).toBeNull()
  })
})
