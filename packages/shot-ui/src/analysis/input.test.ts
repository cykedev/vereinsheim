import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { analysisInput } from "./input"
import { fortyCard } from "./testCard"

describe("analysisInput: die Karte für Abstände (SF-04)", () => {
  it("mit Wertung ist die Karte alle Schüsse, mit der Probe", () => {
    const card = fortyCard()
    const input = analysisInput(card, "decimal", LP_10M)
    expect(input.card).toBe(card)
    expect(input.base.every((s) => s.kind === "match")).toBe(true)
  })

  it("nur Probe: die Karte ist die Probe als Wertung, wie die Grundlage", () => {
    const probe = fortyCard().filter((s) => s.kind === "probe")
    const input = analysisInput(probe, "decimal", LP_10M)
    expect(input.card).toBe(input.base)
    expect(input.card.every((s) => s.kind === "match")).toBe(true)
  })
})
