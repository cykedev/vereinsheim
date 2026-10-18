import { describe, expect, it } from "vitest"

import { scoreBgClass, scoreVar } from "./scoreColors"

describe("scoreVar", () => {
  it("10 rot, 9 gold, 8 türkis, darunter violett, auch in Zehnteln", () => {
    expect(scoreVar(10.4)).toBe("var(--score-10)")
    expect(scoreVar(9.9)).toBe("var(--score-9)")
    expect(scoreVar(8)).toBe("var(--score-8)")
    expect(scoreVar(7.9)).toBe("var(--score-7)")
    expect(scoreVar(0)).toBe("var(--score-7)")
  })
})

describe("scoreBgClass", () => {
  it("aus Zahl oder Text, mit Komma", () => {
    expect(scoreBgClass("10.2")).toBe("bg-score-10")
    expect(scoreBgClass("9,8")).toBe("bg-score-9")
    expect(scoreBgClass(8)).toBe("bg-score-8")
    expect(scoreBgClass("3")).toBe("bg-score-7")
  })

  it("kein Wert, keine Farbe", () => {
    expect(scoreBgClass("")).toBeNull()
    expect(scoreBgClass("x")).toBeNull()
  })
})
