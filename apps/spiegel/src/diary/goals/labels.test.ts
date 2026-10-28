import { describe, expect, it } from "vitest"

import type { GoalSummary } from "./queries"
import { goalHeadMeta, goalListMeta, goalListStand, goalListState, goalPhaseText } from "./labels"

const ZONE = "Europe/Berlin"
const goal = (extra: Partial<GoalSummary> = {}): GoalSummary => ({
  id: "g",
  title: "355 im Training",
  kind: "result",
  family: { id: 1, slug: "lp", name: "Luftpistole" },
  from: "2026-09-01",
  to: "2027-08-31",
  phase: { phase: "running", months: 10 },
  outcome: null,
  rule: null,
  stand: null,
  entries: 3,
  ...extra,
})

describe("Wörter eines Ziels", () => {
  it("Unterzeile in der Liste: bis zum Ende, vorbei der ganze Zeitraum, ohne Disziplin benannt", () => {
    expect(goalListMeta(goal(), ZONE)).toBe("Luftpistole · bis 31.08.2027")
    expect(goalListMeta(goal({ phase: { phase: "past" } }), ZONE)).toBe(
      "Luftpistole · 01.09.2026 – 31.08.2027"
    )
    expect(goalListMeta(goal({ family: null }), ZONE)).toBe("Ohne Disziplin · bis 31.08.2027")
  })

  it("Stand ohne Messung", () => {
    expect(goalListStand(goal())).toBe("Ergebnisziel ohne Messung")
    expect(goalListStand(goal({ kind: "process" }))).toBe("Prozessziel · 3 Einträge im Zeitraum")
    expect(goalListStand(goal({ kind: "process", entries: 1 }))).toBe(
      "Prozessziel · 1 Eintrag im Zeitraum"
    )
  })

  it("Zustand: die Antwort geht vor", () => {
    expect(goalListState(goal(), ZONE)).toBe("läuft")
    expect(goalListState(goal({ outcome: "partly" }), ZONE)).toBe("Teilweise")
    expect(goalListState(goal({ phase: { phase: "upcoming" } }), ZONE)).toBe(
      "beginnt am 01.09.2026"
    )
    expect(goalPhaseText(goal(), ZONE)).toBe("läuft · noch 10 Monate")
    expect(goalPhaseText(goal({ phase: { phase: "running", months: 1 } }), ZONE)).toBe(
      "läuft · noch 1 Monat"
    )
  })

  it("Kopf: Art der Scheiben nur, wenn nicht alle zählen", () => {
    const rule = {
      measure: "card" as const,
      threshold: 355,
      scoring: "rings" as const,
      shots: 40,
      from: "2026-09-01",
      to: "2027-08-31",
    }
    expect(goalHeadMeta(goal({ rule: { ...rule, cards: "training" } }), ZONE)).toBe(
      "Luftpistole · Training · 01.09.2026 – 31.08.2027"
    )
    expect(goalHeadMeta(goal({ rule: { ...rule, cards: "all" } }), ZONE)).toBe(
      "Luftpistole · 01.09.2026 – 31.08.2027"
    )
    expect(goalHeadMeta(goal({ kind: "process", family: null }), ZONE)).toBe(
      "Ohne Disziplin · Prozessziel · 01.09.2026 – 31.08.2027"
    )
  })
})
