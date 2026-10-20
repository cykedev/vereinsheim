import { describe, expect, it } from "vitest"

import { getAuditDescription } from "./description"
import { formatAuditDetails } from "./formatDetails"
import { AUDIT_EVENT_CATEGORY, AUDIT_EVENT_LABELS } from "./types"

describe("Protokoll: Spielplan, Playoff-Runde, Entfernen", () => {
  it("Bezeichnungen wie im Textbuch", () => {
    expect(AUDIT_EVENT_LABELS.SCHEDULE_GENERATED).toBe("Spielplan generiert")
    expect(AUDIT_EVENT_LABELS.SCHEDULE_REGENERATED).toBe("Spielplan neu generiert")
    expect(AUDIT_EVENT_LABELS.PLAYOFF_ROUND_CREATED).toBe("Playoff-Runde angelegt")
    expect(AUDIT_EVENT_LABELS.PARTICIPANT_UNENROLLED).toBe("Teilnehmer aus Wettbewerb entfernt")
    for (const type of [
      "SCHEDULE_GENERATED",
      "SCHEDULE_REGENERATED",
      "PLAYOFF_ROUND_CREATED",
      "PARTICIPANT_UNENROLLED",
    ])
      expect(AUDIT_EVENT_CATEGORY[type]).toBeDefined()
  })

  it("darunter: Paarungen, Runde, Name und Gast", () => {
    expect(getAuditDescription("SCHEDULE_GENERATED", { matchups: 30 })).toBe("30 Paarungen")
    expect(getAuditDescription("SCHEDULE_REGENERATED", { matchups: 1 })).toBe("1 Paarung")
    expect(getAuditDescription("PLAYOFF_ROUND_CREATED", { round: "SEMI_FINAL" })).toBe(
      "Runde: Halbfinale"
    )
    expect(
      getAuditDescription("PARTICIPANT_UNENROLLED", { name: "Anna Birke", isGuest: false })
    ).toBe("Anna Birke")
    expect(getAuditDescription("PARTICIPANT_UNENROLLED", { name: "Anna", isGuest: true })).toBe(
      "Anna · Gast"
    )
  })

  it("Details je Ereignis", () => {
    expect(formatAuditDetails("SCHEDULE_REGENERATED", { matchups: 30 })).toEqual([
      { label: "Paarungen", value: "30" },
    ])
    expect(formatAuditDetails("PLAYOFF_ROUND_CREATED", { round: "FINAL" })).toEqual([
      { label: "Runde", value: "Finale" },
    ])
    expect(formatAuditDetails("PARTICIPANT_UNENROLLED", { name: "Anna", isGuest: true })).toEqual([
      { label: "Name", value: "Anna" },
      { label: "Gast", value: "ja" },
    ])
  })
})
