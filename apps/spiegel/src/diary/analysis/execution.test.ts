import { describe, expect, it } from "vitest"

import { executionCheck, type RatedCard } from "./execution"

/** eine Scheibe mit Serien zu je 10 Schuss (Ø je Schuss) und Bewertungen je Seriennummer */
function rated(
  cardId: string,
  day: string,
  means: (number | null)[],
  ratings: (number | undefined)[]
): RatedCard {
  return {
    entryId: `e-${cardId}`,
    day,
    cardId,
    series: means.map((mean, i) => ({ series: i + 1, shots: 10, mean })),
    ratings: new Map(ratings.flatMap((r, i) => (r === undefined ? [] : [[i + 1, r] as const]))),
  }
}

describe("executionCheck", () => {
  // Eine Scheibe auf hohem Niveau, nur schwach bewertet; eine tiefe, nur gut bewertet. Je Scheibe liegen die besser
  // bewerteten 0,4 über den schwächeren. Über alle Serien am gemeinsamen Median stünden die gut bewerteten der tiefen
  // Scheibe gegen die schwach bewerteten der hohen.
  const cards = [
    rated("a", "2026-03-01", [9.8, 9.4, 9.8, 9.4, 9.8, 9.4], [30, 10, 30, 10, 30, 10]),
    rated("b", "2026-03-02", [8.6, 8.2, 8.6, 8.2, 8.6, 8.2], [90, 70, 90, 70, 90, 70]),
  ]

  it("besser bewertete Serien liegen je Scheibe höher: Urteil über die Serien", () => {
    const result = executionCheck(cards)
    expect(result).toMatchObject({ series: 12, evenings: 2, sameRated: 0, high: 6, low: 6 })
    expect(result.comparison?.test).not.toBeNull()
    expect(result.comparison?.basis).toBe("cards")
    expect(result.comparison?.verdict).toBe("higher")
    expect(result.comparison?.delta).toBeCloseTo(0.4, 9)
  })

  it("über alle Serien geteilt urteilte es umgekehrt", () => {
    const merged: RatedCard = {
      ...cards[0],
      cardId: "all",
      series: [...cards[0].series, ...cards[1].series.map((s) => ({ ...s, series: s.series + 6 }))],
      ratings: new Map([
        ...cards[0].ratings,
        ...[...cards[1].ratings].map(([k, v]) => [k + 6, v] as const),
      ]),
    }
    expect(executionCheck([merged]).comparison?.verdict).toBe("lower")
  })

  it("gleich bewertete Serien sagen nichts und zählen nicht", () => {
    const result = executionCheck([rated("c", "2026-03-03", [9, 9.5, 8.8], [70, 70, 70])])
    expect(result).toMatchObject({ series: 0, evenings: 0, sameRated: 1, high: 0, low: 0 })
    expect(result.comparison).toBeNull()
  })

  it("eine Scheibe mit nur einer bewerteten Serie zählt nicht und gilt nicht als gleich bewertet", () => {
    const result = executionCheck([
      rated("e", "2026-03-05", [9, 9.5, 8.8], [70, undefined, undefined]),
    ])
    expect(result).toMatchObject({ series: 0, evenings: 0, sameRated: 0 })
  })

  it("lässt Serien ohne Wert oder Bewertung und Bewertungen fremder Serien weg", () => {
    const card = rated("d", "2026-03-04", [9, null, 9.6, 9.2], [30, 90, 90, undefined])
    const withForeign: RatedCard = { ...card, ratings: new Map([...card.ratings, [7, 10]]) }
    const result = executionCheck([withForeign])
    expect(result).toMatchObject({ series: 2, high: 1, low: 1 })
    expect(result.comparison?.test).toBeNull()
    expect(result.comparison?.delta).toBeCloseTo(0.6, 9)
  })
})
