import { describe, it, expect } from "vitest"
import { formatParticipantName } from "./formatters"

describe("formatParticipantName", () => {
  it("regulärer Teilnehmer → Nachname, Vorname", () => {
    expect(
      formatParticipantName({ firstName: "Max", lastName: "Mustermann", isGuestRecord: false })
    ).toBe("Mustermann, Max")
  })

  it("Gastteilnehmer → nur Vorname", () => {
    expect(formatParticipantName({ firstName: "Gabi", lastName: "", isGuestRecord: true })).toBe(
      "Gabi"
    )
  })

  it("Gastteilnehmer mit Nachname → trotzdem nur Vorname", () => {
    expect(
      formatParticipantName({ firstName: "Klaus", lastName: "Schmidt", isGuestRecord: true })
    ).toBe("Klaus")
  })
})
