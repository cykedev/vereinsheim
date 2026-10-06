import { describe, expect, it } from "vitest"

import { ANALYSIS_CATALOG } from "./catalog"
import * as analysis from "./index"

describe("ANALYSIS_CATALOG", () => {
  it("nennt jede Auswertung, und nur diese", () => {
    const functions = Object.entries(analysis)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort()
    expect(Object.keys(ANALYSIS_CATALOG).sort()).toEqual(functions)
  })

  it("jede Auswertung hat Katalog-IDs in der Form des Katalogs", () => {
    for (const [name, ids] of Object.entries(ANALYSIS_CATALOG)) {
      expect(ids.length, name).toBeGreaterThan(0)
      for (const id of ids) expect(id, name).toMatch(/^[EPLVZISTRCKWQ]\d+$/)
    }
  })
})
