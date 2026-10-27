import { describe, expect, it } from "vitest"

import { kindOfRow, officialOf } from "./reads"

describe("geltende Art einer Scheibe", () => {
  it("die Wahl des Schützen, sonst die Art der Rangliste, sonst die der Quelle", () => {
    const row = (
      kindChoice: "training" | "competition" | null,
      ranking: "training" | "competition" | null | undefined
    ) => ({
      kind: "training" as const,
      kindChoice,
      ranking: ranking === undefined ? null : { kind: ranking },
    })
    expect(kindOfRow(row(null, undefined), false)).toBe("training")
    expect(kindOfRow(row(null, null), false)).toBe("training")
    expect(kindOfRow(row(null, "competition"), false)).toBe("competition")
    expect(kindOfRow(row("training", "competition"), false)).toBe("training")
    expect(
      kindOfRow({ kind: "competition", kindChoice: null, ranking: { kind: "training" } }, false)
    ).toBe("training")
    // nur Probe ohne Wahl: die Art der Quelle, die Rangliste zählt nicht (der Probeblock eines Wettkampfs bleibt einer)
    expect(kindOfRow(row(null, "competition"), true)).toBe("training")
    expect(kindOfRow({ kind: "competition", kindChoice: null, ranking: null }, true)).toBe(
      "competition"
    )
    expect(
      kindOfRow({ kind: "competition", kindChoice: null, ranking: { kind: "training" } }, true)
    ).toBe("competition")
  })

  it("nur Probe mit Wahl: die Wahl gilt", () => {
    expect(kindOfRow({ kind: "training", kindChoice: "competition", ranking: null }, true)).toBe(
      "competition"
    )
    expect(
      kindOfRow(
        { kind: "competition", kindChoice: "training", ranking: { kind: "competition" } },
        true
      )
    ).toBe("training")
  })
})

describe("Wertung der Disziplin an einer Scheibe", () => {
  it("gilt im Training und im Wettkampf; nur ein Training nur aus Probe hat keine", () => {
    expect(officialOf("rings", "training", false)).toBe("rings")
    expect(officialOf("rings", "competition", false)).toBe("rings")
    expect(officialOf("rings", "competition", true)).toBe("rings")
    expect(officialOf("rings", "training", true)).toBeNull()
    expect(officialOf(null, "competition", true)).toBeNull()
  })
})
