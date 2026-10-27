import { describe, expect, it } from "vitest"

import { inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import type { OverviewCard } from "@/lib/db/reads"

import { blockedItems, daysLeft, trashItems } from "./trash-view"

const ZONE = "Europe/Berlin"
const DAY_MS = 86_400_000
const NOW = Date.UTC(2026, 9, 14, 10)

const card = {
  id: "c1",
  startedAtMs: Date.UTC(2026, 9, 13, 17, 12),
  family: { slug: "lp-freihand", name: "Luftpistole" },
  scoring: "rings",
  provenance: "measured",
  projection: {
    values: { [inScoring(metricByKey("result.decimal")!, "rings").key]: { value: 376 } },
  },
} as unknown as OverviewCard

describe("Papierkorb in Worten", () => {
  it("Abend, Familie, Ergebnis und die verbleibenden Tage", () => {
    const [item] = trashItems([{ card, deletedAtMs: NOW, endsAtMs: NOW + 30 * DAY_MS }], ZONE, NOW)
    expect(item).toEqual({
      cardId: "c1",
      when: "Di 13.10.2026 · 19:12",
      family: "Luftpistole",
      result: "376 Ringe",
      left: "noch 30 Tage",
    })
  })

  it("Tage aufgerundet, Einzahl, am Ende „wird gleich gelöscht“", () => {
    expect(daysLeft(NOW + 29.2 * DAY_MS, NOW)).toBe(30)
    const left = (ms: number) =>
      trashItems([{ card, deletedAtMs: 0, endsAtMs: NOW + ms }], ZONE, NOW)[0].left
    expect(left(DAY_MS / 2)).toBe("noch 1 Tag")
    expect(left(-DAY_MS)).toBe("wird gleich gelöscht")
  })

  it("was nicht wiederkommt, mit Art und Abend", () => {
    const start = Date.UTC(2026, 8, 1, 17, 5)
    expect(
      blockedItems(
        [
          { kind: "deleted", startedAtMs: start, sinceMs: NOW },
          { kind: "not-mine", startedAtMs: start, sinceMs: NOW },
        ],
        ZONE
      ).map((b) => [b.when, b.label])
    ).toEqual([
      ["Di 01.09.2026 · 19:05", "endgültig gelöscht"],
      ["Di 01.09.2026 · 19:05", "als „nicht meine“ zurückgewiesen"],
    ])
  })
})
