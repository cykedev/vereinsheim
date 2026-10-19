import { describe, expect, it } from "vitest"

import { DEFAULT_PROGRESS, type ProgressQuery } from "@vereinsheim/shot-ui/nav/routes"

import { parseRememberedChoice, withRememberedChoice } from "./period-memory-cookie"

const NAMED = [{ id: "neue-munition" }]
const params = (text: string) => new URLSearchParams(text)

describe("gemerkter Zeitraum im Fortschritt", () => {
  it("liest den Wert wie `range` in der Adresse", () => {
    expect(parseRememberedChoice("12m", NAMED)).toEqual({ type: "rolling", days: 365 })
    expect(parseRememberedChoice("6m", NAMED)).toEqual({ type: "rolling", days: 182 })
    expect(parseRememberedChoice("all", NAMED)).toEqual({ type: "all" })
    expect(parseRememberedChoice("2026-07-01..2026-07-31", NAMED)).toEqual({
      type: "free",
      from: "2026-07-01",
      to: "2026-07-31",
    })
    expect(parseRememberedChoice("neue-munition", NAMED)).toEqual({
      type: "named",
      id: "neue-munition",
    })
  })

  it("ohne, kaputt oder ein benannter Zeitraum, den es nicht mehr gibt: keiner", () => {
    expect(parseRememberedChoice(undefined, NAMED)).toBeNull()
    expect(parseRememberedChoice("", NAMED)).toBeNull()
    expect(parseRememberedChoice("Saison 2025", NAMED)).toBeNull()
    expect(parseRememberedChoice("2026-07-31..2026-07-01", NAMED)).toBeNull()
    expect(parseRememberedChoice("geloescht", NAMED)).toBeNull()
  })

  it("gilt nur ohne eigene Abfrage; die Familie aus der Navigation zählt nicht als eigene", () => {
    const remembered = { type: "rolling", days: 365 } as const
    const query: ProgressQuery = { ...DEFAULT_PROGRESS, family: "lp-freihand" }
    expect(withRememberedChoice(DEFAULT_PROGRESS, params(""), remembered).choice).toEqual(
      remembered
    )
    expect(withRememberedChoice(query, params("family=lp-freihand"), remembered)).toEqual({
      ...query,
      choice: remembered,
    })
    // ein Link mit eigener Abfrage gilt, wie er ist: Start „Form“ (Vergleich), aus der Liste (Zeitraum)
    for (const own of [
      "compare=previous&family=lp-freihand",
      "range=all",
      "kind=training",
      "pick=c1",
    ])
      expect(withRememberedChoice(query, params(own), remembered)).toBe(query)
    // ohne gemerkten Zeitraum die Vorgabe
    expect(withRememberedChoice(query, params(""), null)).toBe(query)
  })
})
