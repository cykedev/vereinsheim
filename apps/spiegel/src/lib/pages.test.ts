import { describe, expect, it } from "vitest"

import type { PageCard } from "@/lib/db/reads"

import { familiesOf, listable } from "./pages"

const card = (
  id: string,
  day: number,
  family: string | null,
  targetId: "lp-10m" | null
): PageCard => ({
  id,
  startedAtMs: day * 86_400_000,
  kind: "training",
  complete: true,
  flags: [],
  shots: [],
  revision: 1,
  disciplineId: 1,
  discipline: "LP 40",
  targetId,
  family: family ? { slug: family, name: family.toUpperCase() } : null,
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
