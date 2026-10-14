import { describe, expect, it } from "vitest"

import { ADMIN_HELP } from "./help"

describe("Erklärungen im Admin", () => {
  it("jede Station der Übersicht und jeder Begriff hat einen Text", () => {
    for (const id of [
      "site",
      "bridge",
      "pairingCode",
      "consent",
      "ranking",
      "timeZone",
      "role",
      "deactivated",
      "accounts",
    ] as const) {
      expect(ADMIN_HELP[id].title).not.toBe("")
      expect(ADMIN_HELP[id].text.split(". ").length).toBeLessThanOrEqual(4)
    }
  })

  it("keine Fachbegriffe, die der Admin nicht braucht (D0)", () => {
    const all = JSON.stringify(ADMIN_HELP)
    expect(all).not.toMatch(/Epoche|Neustart|Snapshot|Heartbeat|Token/)
  })
})
