import { describe, expect, it } from "vitest"

import type { OverviewCard } from "@/lib/db/reads"

import { familiesOf, listable, withFamily } from "./pages"

const card = (
  id: string,
  day: number,
  family: string | null,
  targetId: "lp-10m" | null
): OverviewCard => ({
  id,
  startedAtMs: day * 86_400_000,
  kind: "training",
  complete: true,
  flags: [],
  disciplineId: 1,
  familyId: null,
  state: "final",
  stand: null,
  scoring: "decimal",
  targetId,
  family: family ? { slug: family, name: family.toUpperCase() } : null,
  list: null,
  provenance: "measured",
  projection: {
    version: "p",
    probeOnly: false,
    suspicious: false,
    printedShots: 0,
    values: {},
    records: { decimal: null, rings: null },
  },
})

describe("familiesOf", () => {
  it("die Familie der neuesten Scheibe zuerst; ohne Familie oder Scheibenbild nicht", () => {
    const cards = [
      card("a", 1, "lp-freihand", "lp-10m"),
      card("b", 3, "lg-freihand", "lp-10m"),
      card("c", 2, "lp-freihand", "lp-10m"),
      card("d", 4, null, "lp-10m"),
      card("e", 5, "lp-auflage", null),
    ]
    expect(familiesOf(cards).map((f) => f.value)).toEqual(["lg-freihand", "lp-freihand"])
    expect(familiesOf(cards)[0]).toEqual({
      value: "lg-freihand",
      label: "LG-FREIHAND",
      targetId: "lp-10m",
    })
    expect(listable(cards).map((c) => c.id)).toEqual(["a", "b", "c"])
  })
})

describe("withFamily", () => {
  it("gibt Familie, Liste und Herkunft an die Modelle weiter", () => {
    const listed = { ...card("a", 1, "lp-freihand", "lp-10m"), list: { id: 7, name: "RWK_LP" } }
    expect(withFamily([listed, card("b", 2, "lp-freihand", "lp-10m")])).toEqual([
      {
        card: listed,
        family: "lp-freihand",
        list: { id: 7, name: "RWK_LP" },
        provenance: "measured",
      },
      {
        card: expect.objectContaining({ id: "b" }),
        family: "lp-freihand",
        list: null,
        provenance: "measured",
      },
    ])
  })
})
