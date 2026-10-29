import { describe, expect, it } from "vitest"

import { areaOf, barAreaOf, currentArea } from "./areas"

describe("areaOf", () => {
  it("Start nur exakt auf dem Dashboard", () => {
    expect(areaOf("/dashboard")).toBe("start")
    expect(areaOf("/")).toBeNull()
  })

  it("Neue Einheit vor dem Tagebuch, eine Einheit gehört zum Tagebuch", () => {
    expect(areaOf("/sessions/new")).toBe("new")
    expect(areaOf("/sessions")).toBe("sessions")
    expect(areaOf("/sessions/abc/edit")).toBe("sessions")
  })

  it("Bereiche mit Unterseiten, Profil auch unter der alten Adresse", () => {
    expect(areaOf("/statistics")).toBe("statistics")
    expect(areaOf("/goals/x")).toBe("goals")
    expect(areaOf("/shot-routines/x/edit")).toBe("routines")
    expect(areaOf("/disciplines/new")).toBe("disciplines")
    expect(areaOf("/profile")).toBe("profile")
    expect(areaOf("/account")).toBe("profile")
    expect(areaOf("/admin/users/new")).toBe("admin")
  })

  it("nichts für ähnliche Adressen", () => {
    expect(areaOf("/sessionsx")).toBeNull()
    expect(areaOf("/administration")).toBeNull()
  })
})

describe("barAreaOf", () => {
  it("was nicht in der Leiste steht, zeigt dort Profil", () => {
    expect(barAreaOf("goals")).toBe("profile")
    expect(barAreaOf("routines")).toBe("profile")
    expect(barAreaOf("disciplines")).toBe("profile")
    expect(barAreaOf("admin")).toBe("profile")
  })

  it("Einträge der Leiste bleiben, ohne Bereich keiner", () => {
    expect(barAreaOf("sessions")).toBe("sessions")
    expect(barAreaOf("new")).toBe("new")
    expect(barAreaOf(null)).toBeNull()
  })
})

describe("currentArea", () => {
  it("umgezogen gehört /sessions/new zum Tagebuch, sonst zur Aktion", () => {
    expect(currentArea("/sessions/new", true)).toBe("sessions")
    expect(currentArea("/sessions/new", false)).toBe("new")
  })

  it("alle anderen Adressen wie areaOf", () => {
    expect(currentArea("/dashboard", true)).toBe("start")
    expect(currentArea("/dashboard", false)).toBe("start")
    expect(currentArea("/goals/x", true)).toBe("goals")
  })
})
