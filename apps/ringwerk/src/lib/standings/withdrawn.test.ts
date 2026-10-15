import { describe, expect, it } from "vitest"
import { involvesWithdrawn } from "./withdrawn"

const withdrawn = new Set(["W"])

describe("involvesWithdrawn", () => {
  it("Zurückgezogener zu Hause", () => {
    expect(involvesWithdrawn({ homeParticipantId: "W", awayParticipantId: "A" }, withdrawn)).toBe(
      true
    )
  })

  it("Zurückgezogener auswärts", () => {
    expect(involvesWithdrawn({ homeParticipantId: "A", awayParticipantId: "W" }, withdrawn)).toBe(
      true
    )
  })

  it("beide aktiv", () => {
    expect(involvesWithdrawn({ homeParticipantId: "A", awayParticipantId: "B" }, withdrawn)).toBe(
      false
    )
  })

  it("Freilos eines Aktiven", () => {
    expect(involvesWithdrawn({ homeParticipantId: "A", awayParticipantId: null }, withdrawn)).toBe(
      false
    )
  })
})
