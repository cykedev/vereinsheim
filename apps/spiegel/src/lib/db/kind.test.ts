import { describe, expect, it } from "vitest"

import { kindOfRow } from "./reads"

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
    expect(kindOfRow(row(null, undefined))).toBe("training")
    expect(kindOfRow(row(null, null))).toBe("training")
    expect(kindOfRow(row(null, "competition"))).toBe("competition")
    expect(kindOfRow(row("training", "competition"))).toBe("training")
    expect(
      kindOfRow({ kind: "competition", kindChoice: null, ranking: { kind: "training" } })
    ).toBe("training")
  })
})
