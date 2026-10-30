import { describe, expect, it } from "vitest"

import { beforeAfter, expectedRows, stagePosition } from "./self-image"

const result = (value: number) => ({ value, scoring: "rings" as const, digits: 0 })
const scored = (value: number | null) => ({
  result: value === null ? null : result(value),
  probeOnly: false,
})
const probe = (value: number) => ({ result: result(value), probeOnly: true })

describe("expectedRows", () => {
  it("nimmt Einträge mit genau einer Scheibe mit Wertung und Ergebnis, neueste oben, und mittelt die Abstände", () => {
    const { rows, mean, left } = expectedRows([
      { id: "a", day: "2026-03-01", expectedScore: 365, cards: [scored(358)] },
      { id: "b", day: "2026-03-08", expectedScore: 360, cards: [scored(362)] },
      { id: "c", day: "2026-03-05", expectedScore: 370, cards: [scored(360)] },
      { id: "d", day: "2026-03-06", expectedScore: null, cards: [scored(350)] },
    ])
    expect(rows.map((r) => r.entryId)).toEqual(["b", "c", "a"])
    expect(rows.map((r) => r.delta)).toEqual([2, -10, -7])
    expect(mean).toBeCloseTo(-5, 9)
    expect(left).toBe(0)
  })

  it("zwei Scheiben oder eine ohne Ergebnis: keine Zeile, gezählt", () => {
    const { rows, mean, left } = expectedRows([
      {
        id: "a",
        day: "2026-03-01",
        expectedScore: 365,
        cards: [scored(358), scored(90)],
      },
      { id: "b", day: "2026-03-02", expectedScore: 365, cards: [scored(null)] },
    ])
    expect(rows).toEqual([])
    expect(mean).toBeNull()
    expect(left).toBe(2)
  })

  it("nimmt neben einer Probe-Scheibe die Wertung, ohne Wertung genau eine Probe", () => {
    const { rows, left } = expectedRows([
      { id: "a", day: "2026-03-01", expectedScore: 365, cards: [probe(92), scored(358)] },
      { id: "b", day: "2026-03-02", expectedScore: 365, cards: [scored(361), probe(95)] },
      { id: "c", day: "2026-03-03", expectedScore: 90, cards: [probe(93)] },
      { id: "d", day: "2026-03-04", expectedScore: 90, cards: [probe(93), probe(94)] },
      {
        id: "e",
        day: "2026-03-05",
        expectedScore: 365,
        cards: [probe(92), scored(358), scored(360)],
      },
    ])
    expect(rows.map((r) => [r.entryId, r.shot.value, r.delta])).toEqual([
      ["c", 93, 3],
      ["b", 361, -4],
      ["a", 358, -7],
    ])
    expect(left).toBe(2)
  })
})

describe("stagePosition", () => {
  it("legt die Mitte einer Stufe auf ihre Zahl und bleibt zwischen 1 und 5", () => {
    expect(stagePosition(10)).toBe(1)
    expect(stagePosition(50)).toBe(3)
    expect(stagePosition(90)).toBe(5)
    expect(stagePosition(0)).toBe(1)
    expect(stagePosition(100)).toBe(5)
    expect(stagePosition(60)).toBe(3.5)
  })
})

describe("beforeAfter", () => {
  it("mittelt je Bereich nur Einträge mit Prognose und Feedback", () => {
    const { n, rows } = beforeAfter([
      {
        scales: [
          { part: "prognosis", aspect: "technique", value: 70 },
          { part: "feedback", aspect: "technique", value: 50 },
          { part: "prognosis", aspect: "fitness", value: 90 },
        ],
      },
      {
        scales: [
          { part: "prognosis", aspect: "technique", value: 50 },
          { part: "feedback", aspect: "technique", value: 30 },
          { part: "wellbeing", aspect: "sleep", value: 90 },
        ],
      },
      { scales: [{ part: "feedback", aspect: "tactics", value: 10 }] },
    ])
    expect(n).toBe(2)
    expect(rows.map((r) => r.aspect)).toEqual([
      "fitness",
      "nutrition",
      "technique",
      "tactics",
      "mentalStrength",
      "environment",
      "equipment",
    ])
    expect(rows.find((r) => r.aspect === "technique")).toEqual({
      aspect: "technique",
      prognosis: 60,
      feedback: 40,
      pairs: 2,
    })
    expect(rows.find((r) => r.aspect === "fitness")).toEqual({
      aspect: "fitness",
      prognosis: null,
      feedback: null,
      pairs: 0,
    })
  })
})
