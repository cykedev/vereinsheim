import { describe, expect, it } from "vitest"

import { parseRememberedChoice, parseScorings, serializeScorings } from "@/lib/statistics/memory"

describe("Gemerkter Zeitraum", () => {
  it("in der Form von `range`; kaputt, leer oder benannt keiner", () => {
    expect(parseRememberedChoice("6m")).toEqual({ type: "rolling", days: 182 })
    expect(parseRememberedChoice("all")).toEqual({ type: "all" })
    expect(parseRememberedChoice("2026-07-01..2026-07-31")).toEqual({
      type: "free",
      from: "2026-07-01",
      to: "2026-07-31",
    })
    expect(parseRememberedChoice(undefined)).toBeNull()
    expect(parseRememberedChoice("quatsch!")).toBeNull()
  })
})

describe("Gemerkte Wertung je Disziplin", () => {
  it("hin und zurück, Zehntel als Vorgabe ohne Eintrag", () => {
    const value = serializeScorings({ cabc123: "rings", cdef456: "decimal", "lg-zehntel": "rings" })
    expect(value).toBe("cabc123:rings,lg-zehntel:rings")
    expect(parseScorings(value)).toEqual({ cabc123: "rings", "lg-zehntel": "rings" })
    // wie der Browser schreibt: kodiert
    expect(parseScorings(encodeURIComponent("cabc:rings,cdef:decimal"))).toEqual({
      cabc: "rings",
      cdef: "decimal",
    })
  })

  it("Kaputtes fällt weg", () => {
    expect(parseScorings("x y:rings,ok:zehntel,gut:rings,%E0")).toEqual({})
    expect(parseScorings("gut:rings,Böse:rings")).toEqual({ gut: "rings" })
    expect(parseScorings(undefined)).toEqual({})
  })
})
