import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { SCORE_HEX, scoreKey } from "./score-colors"

const css = readFileSync(fileURLToPath(new URL("../../design2.css", import.meta.url)), "utf8")

describe("Ringwert-Farben", () => {
  it("gleichen `--score-*` in design2.css", () => {
    for (const [key, hex] of Object.entries(SCORE_HEX))
      expect(css, `--score-${key}`).toContain(`--score-${key}: ${hex};`)
  })

  it("ordnen ganze Ringe und Zehntel ihrer Stufe zu", () => {
    expect([10.9, 10, 10.0].map(scoreKey)).toEqual([10, 10, 10])
    expect([9.9, 9].map(scoreKey)).toEqual([9, 9])
    expect([8.9, 8].map(scoreKey)).toEqual([8, 8])
    expect([7.9, 7, 3, 0].map(scoreKey)).toEqual([7, 7, 7, 7])
  })
})
