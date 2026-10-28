import { describe, expect, it } from "vitest"

import {
  ASPECT_LABELS,
  SCALE_ASPECTS,
  isAspectOf,
  scaleEntry,
  stageOf,
  stageWords,
  valueOfStage,
  wordOf,
  type Stage,
} from "./scales"

describe("stageOf", () => {
  it("teilt 0 bis 100 in fünf Bereiche", () => {
    const cases: [number, Stage][] = [
      [0, 1],
      [19, 1],
      [20, 2],
      [39, 2],
      [40, 3],
      [59, 3],
      [60, 4],
      [79, 4],
      [80, 5],
      [100, 5],
    ]
    for (const [value, stage] of cases) expect(stageOf(value)).toBe(stage)
  })

  it("speichert für eine Stufe ihre Mitte, und die Mitte liegt in der Stufe", () => {
    expect([1, 2, 3, 4, 5].map((s) => valueOfStage(s as Stage))).toEqual([10, 30, 50, 70, 90])
    for (const s of [1, 2, 3, 4, 5] as Stage[]) expect(stageOf(valueOfStage(s))).toBe(s)
  })
})

describe("Aspekte", () => {
  it("nimmt je Teil nur die Aspekte aus der festen Liste", () => {
    expect(isAspectOf("wellbeing", "sleep")).toBe(true)
    expect(isAspectOf("wellbeing", "technique")).toBe(false)
    expect(isAspectOf("prognosis", "technique")).toBe(true)
    expect(isAspectOf("feedback", "sleep")).toBe(false)
    expect(isAspectOf("feedback", "Technik")).toBe(false)
  })

  it("lehnt einen fremden Aspekt und Werte außerhalb von 0 bis 100 ab", () => {
    expect(scaleEntry.safeParse({ part: "wellbeing", aspect: "stress", value: 43 }).success).toBe(
      true
    )
    expect(scaleEntry.safeParse({ part: "wellbeing", aspect: "tactics", value: 50 }).success).toBe(
      false
    )
    expect(scaleEntry.safeParse({ part: "prognosis", aspect: "x", value: 50 }).success).toBe(false)
    expect(
      scaleEntry.safeParse({ part: "feedback", aspect: "technique", value: 101 }).success
    ).toBe(false)
    expect(scaleEntry.safeParse({ part: "feedback", aspect: "technique", value: -1 }).success).toBe(
      false
    )
    expect(
      scaleEntry.safeParse({ part: "feedback", aspect: "technique", value: 50.5 }).success
    ).toBe(false)
    expect(scaleEntry.safeParse({ part: "mood", aspect: "sleep", value: 50 }).success).toBe(false)
  })

  it("hat für jeden Aspekt einen Namen", () => {
    for (const aspects of Object.values(SCALE_ASPECTS))
      for (const aspect of aspects) expect(ASPECT_LABELS[aspect]).toBeTruthy()
  })
})

describe("Wörter der Stufen", () => {
  it("sagt beim Befinden wie viel, beim Schlaf wie gut", () => {
    expect(wordOf(90, "wellbeing", "stress")).toBe("sehr viel")
    expect(wordOf(90, "wellbeing", "sleep")).toBe("sehr gut")
    expect(wordOf(10, "wellbeing", "sleep")).toBe("schlecht")
    expect(wordOf(30, "prognosis", "technique")).toBe("mäßig")
    expect(wordOf(70, "execution")).toBe("gut")
    expect(stageWords("feedback", "equipment")).toHaveLength(5)
  })
})
