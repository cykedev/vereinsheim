import { describe, expect, it } from "vitest"

import {
  influences,
  influenceVerdict,
  ALL_SAME,
  NOTHING_ENTERED,
  TOO_FEW,
  sessionQuality,
  splitAtMedian,
  type InfluenceEntry,
  type InfluenceKey,
} from "@/lib/statistics/influences"

const DAY = 86_400_000
let next = 0
/** eine Einheit mit Ø je Schuss und Merkmalen */
const entry = (value: number, factors: Partial<Record<InfluenceKey, number>>): InfluenceEntry => {
  next += 1
  return { value: { id: `e${next}`, atMs: next * DAY, value, n: 40 }, factors }
}

const of = (key: InfluenceKey, rows: InfluenceEntry[]) =>
  influences(rows).find((r) => r.key === key)!

describe("Einflüsse", () => {
  it("nach gutem Schlaf klar höher: sechs gegen sechs, jede obere Einheit über jeder unteren", () => {
    // Schlaf und Ø gegenläufig sortiert: wer die Gruppen nach Reihenfolge statt nach Wert bildet, bekommt das Gegenteil
    const rows = [
      entry(9.9, { sleep: 90 }),
      entry(9.1, { sleep: 20 }),
      entry(9.8, { sleep: 80 }),
      entry(9.0, { sleep: 10 }),
      entry(9.7, { sleep: 100 }),
      entry(9.2, { sleep: 30 }),
      entry(9.6, { sleep: 70 }),
      entry(9.3, { sleep: 40 }),
      entry(9.75, { sleep: 95 }),
      entry(9.05, { sleep: 15 }),
      entry(9.65, { sleep: 75 }),
      entry(9.15, { sleep: 25 }),
    ]
    const sleep = of("sleep", rows)
    expect(sleep.entered).toBe(12)
    expect(sleep.high.n).toBe(6)
    expect(sleep.low.n).toBe(6)
    expect(sleep.high.mean).toBeCloseTo(9.7333, 3)
    expect(sleep.low.mean).toBeCloseTo(9.1333, 3)
    expect(sleep.comparison?.delta).toBeCloseTo(0.6, 10)
    expect(sleep.comparison?.verdict).toBe("higher")
    expect(sleep.comparison?.meaningful).toBe(true)
  })

  it("viel Stress schwächer: das Urteil sieht von der hohen Gruppe aus", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
      entry(i <= 5 ? 9.8 - i / 100 : 9.2 - i / 100, { stress: i * 10 })
    )
    const stress = of("stress", rows)
    expect(stress.comparison?.delta).toBeLessThan(0)
    expect(stress.comparison?.verdict).toBe("lower")
  })

  it("Einheiten genau auf dem mittleren Wert zählen in keiner Gruppe", () => {
    // vier auf dem Median 50 mit auffällig hohem Ø: zählten sie oben mit, stiege das Mittel der hohen Gruppe
    const rows = [
      ...[1, 2, 3, 4].map(() => entry(10.5, { energy: 50 })),
      ...[1, 2, 3, 4, 5].map((i) => entry(9 + i / 100, { energy: 30 })),
      ...[1, 2, 3, 4, 5].map((i) => entry(9.5 + i / 100, { energy: 70 })),
    ]
    const split = splitAtMedian(rows, "energy")
    expect(split.entered).toBe(14)
    expect(split.high.map((v) => v.value)).toEqual([9.51, 9.52, 9.53, 9.54, 9.55])
    expect(split.low.map((v) => v.value)).toEqual([9.01, 9.02, 9.03, 9.04, 9.05])
  })

  it("unter fünf Einheiten je Seite kein Urteil, ohne Werte kein Vergleich", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => entry(9 + i / 10, { motivation: i }))
    const motivation = of("motivation", rows)
    expect(motivation.high.n).toBe(4)
    expect(motivation.comparison?.test).toBeNull()
    const quality = of("quality", rows)
    expect(quality.entered).toBe(0)
    expect(quality.comparison).toBeNull()
    expect(quality.high).toEqual({ n: 0, mean: null })
  })
})

describe("Ausführung einer Einheit", () => {
  it("Mittel der bewerteten Wertungsserien, ohne Probe und ohne Serien ohne Ergebnis", () => {
    expect(
      sessionQuality([
        { isPractice: true, scoreTotal: 50, executionQuality: 1 },
        { isPractice: false, scoreTotal: 95, executionQuality: 4 },
        { isPractice: false, scoreTotal: null, executionQuality: 1 },
        { isPractice: false, scoreTotal: 97, executionQuality: 5 },
        { isPractice: false, scoreTotal: 96, executionQuality: null },
      ])
    ).toBe(4.5)
    expect(
      sessionQuality([{ isPractice: false, scoreTotal: 95, executionQuality: null }])
    ).toBeNull()
  })
})

describe("Urteil eines Merkmals", () => {
  const words = (c: { meaningful: boolean | null; verdict: string }) =>
    `${c.meaningful ? "deutlich " : ""}${c.verdict === "higher" ? "besser" : "schwächer"}`
  const base = influences([])[0]
  const groups = { high: { n: 6, mean: 9.5 }, low: { n: 6, mean: 9 } }
  const comparison = {
    a: { n: 6, mean: 9 },
    b: { n: 6, mean: 9.5 },
    delta: 0.5,
    test: { p: 0.01, exact: true },
    verdict: "higher" as const,
    meaningful: true,
  }

  it("vom hohen Wert aus, in den Worten des Vergleichs", () => {
    expect(influenceVerdict({ ...base, ...groups, entered: 12, comparison }, words)).toBe(
      "Guter Schlaf: deutlich besser"
    )
    expect(
      influenceVerdict(
        {
          ...base,
          ...groups,
          key: "stress",
          entered: 12,
          comparison: { ...comparison, verdict: "lower", meaningful: false },
        },
        words
      )
    ).toBe("Viel Stress: schwächer")
  })

  it("ohne Urteil: kein klarer Unterschied, zu wenige, nichts eingetragen", () => {
    expect(
      influenceVerdict(
        { ...base, ...groups, entered: 12, comparison: { ...comparison, verdict: "unclear" } },
        words
      )
    ).toBe("Kein klarer Unterschied")
    expect(
      influenceVerdict(
        { ...base, ...groups, entered: 8, comparison: { ...comparison, test: null } },
        words
      )
    ).toBe(TOO_FEW)
    expect(influenceVerdict(base, words)).toBe(NOTHING_ENTERED.wellbeing)
    const same = of(
      "motivation",
      [1, 2, 3, 4].map(() => entry(9.5, { motivation: 70 }))
    )
    expect(influenceVerdict(same, words)).toBe(ALL_SAME)
    expect(influenceVerdict({ ...base, key: "quality" }, words)).toBe(NOTHING_ENTERED.quality)
  })
})
