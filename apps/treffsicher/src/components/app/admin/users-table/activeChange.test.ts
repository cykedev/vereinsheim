import { describe, expect, it } from "vitest"

import { confirmedDeactivation, requestActiveChange } from "./activeChange"

const user = { id: "u2", name: "Konto zwei" }

describe("requestActiveChange", () => {
  it("Deaktivieren fragt mit dem gewählten Konto nach", () => {
    expect(requestActiveChange(user, false)).toEqual({ kind: "confirm", user })
  })

  it("Aktivieren läuft sofort für dieses Konto", () => {
    expect(requestActiveChange(user, true)).toEqual({ kind: "run", userId: "u2", isActive: true })
  })
})

describe("confirmedDeactivation", () => {
  it("deaktiviert das gewählte Konto", () => {
    expect(confirmedDeactivation(user)).toEqual({ userId: "u2", isActive: false })
  })

  it("ohne Wahl nichts", () => {
    expect(confirmedDeactivation(null)).toBeNull()
  })
})
