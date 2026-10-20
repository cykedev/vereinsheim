import { describe, expect, it } from "vitest"

import { leagueTieColumn } from "./standingsSort"
import type { StandingRow } from "./standingsTypes"

const row = { bestRingteiler: 9, bestRings: 97 } as StandingRow

describe("leagueTieColumn: die Spalte, die einen Gleichstand trennt", () => {
  it.each(["RINGS", "RINGS_DECIMAL"] as const)("%s: die meisten Ringe, ohne „?“", (mode) => {
    const column = leagueTieColumn(mode)
    expect(column.label).toBe("Best. Ringe")
    expect(column.value(row)).toBe(97)
    expect(column.format(97, "WHOLE")).toBe("97")
    expect(column.format(104.5, "DECIMAL")).toBe("104,5")
    expect(column.help).toBeNull()
  })

  it.each(["RINGTEILER", "TEILER"] as const)("%s: der beste Ringteiler mit „?“", (mode) => {
    const column = leagueTieColumn(mode)
    expect(column.label).toBe("Best. RT")
    expect(column.value(row)).toBe(9)
    expect(column.format(9, "WHOLE")).toBe("9,0")
    expect(column.help).toBe("ringteiler")
  })
})
