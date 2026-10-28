import { describe, expect, it } from "vitest"

import { proposals, type ProposalCard } from "./proposals"

const LP = { id: 1, slug: "lp", name: "Luftpistole" }
const LPA = { id: 2, slug: "lpa", name: "Luftpistole Auflage" }
const card = (
  id: string,
  day: string,
  hour: number,
  family: ProposalCard["family"] = LP
): ProposalCard => ({
  id,
  day,
  startedAtMs: Date.UTC(2026, 9, Number(day.slice(8)), hour),
  family,
})

describe("Vorschläge für einen neuen Eintrag", () => {
  const cards = [
    card("a2", "2026-10-20", 19),
    card("a1", "2026-10-20", 18),
    card("b1", "2026-10-20", 18, LPA),
    card("c1", "2026-10-16", 18),
    card("d1", "2026-10-09", 18),
    card("x1", "2026-10-02", 18, null),
  ]

  it("je Abend und Disziplin, neueste zuerst, die Scheiben in zeitlicher Folge", () => {
    const list = proposals(cards, [], new Set())
    expect(list.map((p) => [p.day, p.family.slug, p.cards.map((c) => c.id)])).toEqual([
      ["2026-10-20", "lp", ["a1", "a2"]],
      ["2026-10-20", "lpa", ["b1"]],
      ["2026-10-16", "lp", ["c1"]],
      ["2026-10-09", "lp", ["d1"]],
    ])
  })

  it("lässt Abende mit einem Eintrag dieser Disziplin weg, außer der Eintrag liegt im Papierkorb", () => {
    const list = proposals(
      cards,
      [
        { day: "2026-10-20", familyId: LP.id, deleted: false },
        { day: "2026-10-16", familyId: LP.id, deleted: true },
      ],
      new Set()
    )
    expect(list.map((p) => `${p.day} ${p.family.slug}`)).toEqual([
      "2026-10-20 lpa",
      "2026-10-16 lp",
      "2026-10-09 lp",
    ])
  })

  it("lässt Scheiben weg, die fest in einem Eintrag stecken", () => {
    const list = proposals(cards, [], new Set(["c1", "a1"]))
    expect(list.map((p) => p.cards.map((c) => c.id))).toEqual([["a2"], ["b1"], ["d1"]])
  })

  it("markiert den Vorschlag der Scheibe aus der Adresse", () => {
    const list = proposals(cards, [], new Set(), "c1")
    expect(list.filter((p) => p.marked).map((p) => p.day)).toEqual(["2026-10-16"])
  })
})
