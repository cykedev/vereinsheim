import { describe, expect, it } from "vitest"

import { decideCard, type EveningCard } from "./decide"

const WHOLE = { type: "TRAINING" as const, scoring: "WHOLE" as const }
const TENTH = { type: "WETTKAMPF" as const, scoring: "TENTH" as const }
const rings = (total: number, shots = 40) => ({ shots, total: { rings: total } })
const tenths = (total: number, shots = 40) => ({ shots, total: { decimalTenths: total } })

// Ringe und Zehntel so, dass sie nicht ineinander umzurechnen sind: Eine Regel, die die falsche Wertung vergleicht,
// trifft dann eine andere Scheibe
const card = (id: string, over: Partial<EveningCard> = {}): EveningCard => ({
  id,
  probeOnly: false,
  shots: 40,
  totals: { rings: 360, decimalTenths: 3784 },
  ...over,
})

describe("decideCard", () => {
  it("ohne Schießen keine Scheibe, auch mit Angaben", () => {
    for (const type of ["TROCKENTRAINING", "MENTAL"] as const)
      expect(decideCard({ type, scoring: "WHOLE" }, rings(360), [card("a")])).toEqual({
        kind: "none",
        reason: "notShooting",
      })
  })

  it("ohne Angaben keine Scheibe, auch an einem Abend mit Scheiben", () => {
    expect(decideCard(WHOLE, null, [card("a")])).toEqual({ kind: "none", reason: "noResult" })
    expect(decideCard(WHOLE, null, [])).toEqual({ kind: "none", reason: "noResult" })
  })

  it("ohne Scheibe am Abend eine neue", () => {
    expect(decideCard(WHOLE, rings(360), [])).toEqual({ kind: "new" })
  })

  it("verknüpft die passende Scheibe in ganzen Ringen", () => {
    expect(decideCard(WHOLE, rings(360), [card("a")])).toEqual({
      kind: "existing",
      cardIds: ["a"],
    })
  })

  it("verknüpft die passende Scheibe in Zehnteln", () => {
    expect(decideCard(TENTH, tenths(3784), [card("a")])).toEqual({
      kind: "existing",
      cardIds: ["a"],
    })
  })

  it("verknüpft zwei passende, nicht die anderen", () => {
    const decision = decideCard(WHOLE, rings(360), [
      card("a"),
      card("b", { totals: { rings: 355, decimalTenths: 3720 } }),
      card("c"),
    ])
    expect(decision).toEqual({ kind: "existing", cardIds: ["a", "c"] })
  })

  it("gleiche Schusszahl, anderes Ergebnis: unsicher, beide behalten", () => {
    expect(decideCard(WHOLE, rings(343), [card("a")])).toEqual({
      kind: "uncertain",
      others: [{ cardId: "a", shots: 40, total: 360 }],
    })
  })

  it("gleiches Ergebnis, andere Schusszahl: unsicher", () => {
    expect(decideCard(WHOLE, rings(360), [card("a", { shots: 3 })])).toMatchObject({
      kind: "uncertain",
    })
  })

  it("in ganzen Ringen zählen die Ringe, nicht die Zehntel", () => {
    // 360,0 in Zehnteln wäre 3600; die Scheibe hat 3600 Zehntel, aber 355 Ringe
    const decision = decideCard(WHOLE, rings(360), [
      card("a", { totals: { rings: 355, decimalTenths: 3600 } }),
    ])
    expect(decision).toEqual({
      kind: "uncertain",
      others: [{ cardId: "a", shots: 40, total: 355 }],
    })
  })

  it("in Zehnteln zählen die Zehntel, nicht die Ringe", () => {
    // die Scheibe hat 378 Ringe; in Zehnteln 3784, Treffsicher 3780
    const decision = decideCard(TENTH, tenths(3780), [
      card("a", { totals: { rings: 378, decimalTenths: 3784 } }),
    ])
    expect(decision).toMatchObject({ kind: "uncertain" })
  })

  it("nur Scheiben „nur Probe“ am Abend: keine neue, auch wenn Zahlen gleich sind", () => {
    const decision = decideCard(WHOLE, rings(360), [
      card("p1", { probeOnly: true }),
      card("p2", { probeOnly: true, shots: 12 }),
    ])
    expect(decision).toEqual({ kind: "probeEvening", cardIds: ["p1", "p2"] })
  })

  it("Probe neben einer passenden Scheibe: nur die passende", () => {
    expect(decideCard(WHOLE, rings(360), [card("p", { probeOnly: true }), card("a")])).toEqual({
      kind: "existing",
      cardIds: ["a"],
    })
  })

  it("Probe neben einer gewerteten, die nicht passt: unsicher, die Probe nicht unter den anderen", () => {
    expect(decideCard(WHOLE, rings(343), [card("p", { probeOnly: true }), card("a")])).toEqual({
      kind: "uncertain",
      others: [{ cardId: "a", shots: 40, total: 360 }],
    })
  })

  it("ohne Gesamtergebnis in Treffsicher nie verknüpft", () => {
    expect(decideCard(WHOLE, { shots: 40, total: null }, [card("a")])).toMatchObject({
      kind: "uncertain",
    })
    const noValue = card("b", { totals: { rings: null, decimalTenths: null } })
    expect(decideCard(WHOLE, { shots: 40, total: null }, [noValue])).toMatchObject({
      kind: "uncertain",
    })
  })

  it("eine Scheibe ohne Ergebnis passt nie", () => {
    const noValue = card("a", { totals: { rings: null, decimalTenths: null } })
    expect(decideCard(WHOLE, rings(360), [noValue])).toEqual({
      kind: "uncertain",
      others: [{ cardId: "a", shots: 40, total: null }],
    })
  })
})
