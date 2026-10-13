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
    expect(kindOfRow(row(null, undefined), false)).toBe("training")
    expect(kindOfRow(row(null, null), false)).toBe("training")
    expect(kindOfRow(row(null, "competition"), false)).toBe("competition")
    expect(kindOfRow(row("training", "competition"), false)).toBe("training")
    expect(
      kindOfRow({ kind: "competition", kindChoice: null, ranking: { kind: "training" } }, false)
    ).toBe("training")
    // nur Probe ist Training, auch in einer Wettkampf-Rangliste (der Schütze kann es dort nicht umstellen)
    expect(kindOfRow(row(null, "competition"), true)).toBe("training")
  })
})
