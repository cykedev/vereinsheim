import { describe, expect, it } from "vitest"

import { areaOf, barAreaOf, barAreas, moreAreas, primaryAreas, secondaryAreas } from "./areas"

describe("areaOf", () => {
  it("Start nur exakt auf /", () => {
    expect(areaOf("/")).toBe("start")
    expect(areaOf("/unbekannt")).toBeNull()
  })

  it("Bereiche mit Unterseiten; die Teilnehmer eines Wettbewerbs gehören zu Wettbewerbe", () => {
    expect(areaOf("/competitions")).toBe("competitions")
    expect(areaOf("/competitions/abc/participants")).toBe("competitions")
    expect(areaOf("/participants/new")).toBe("participants")
    expect(areaOf("/disciplines/x/edit")).toBe("disciplines")
  })

  it("Profil auch unter der alten Adresse, Admin im ganzen Bereich", () => {
    expect(areaOf("/profile")).toBe("profile")
    expect(areaOf("/account")).toBe("profile")
    expect(areaOf("/admin/users/new")).toBe("admin")
    expect(areaOf("/admin/audit-log")).toBe("admin")
  })

  it("nichts für ähnliche Adressen", () => {
    expect(areaOf("/competitionsx")).toBeNull()
    expect(areaOf("/administration")).toBeNull()
  })
})

describe("Bereiche je Rolle", () => {
  it("Admin: alles, Teilnehmer in der Leiste, Disziplinen und Admin in Profil", () => {
    expect(primaryAreas("ADMIN")).toEqual(["start", "competitions", "participants", "disciplines"])
    expect(secondaryAreas("ADMIN")).toEqual(["profile", "admin"])
    expect(barAreas("ADMIN")).toEqual(["start", "competitions", "participants", "profile"])
    expect(moreAreas("ADMIN")).toEqual(["disciplines", "admin"])
  })

  it("Sportleitung: wie Admin ohne Admin", () => {
    expect(secondaryAreas("MANAGER")).toEqual(["profile"])
    expect(barAreas("MANAGER")).toEqual(["start", "competitions", "participants", "profile"])
    expect(moreAreas("MANAGER")).toEqual(["disciplines"])
  })

  it("Mitglied: Start, Wettbewerbe, Profil", () => {
    expect(primaryAreas("USER")).toEqual(["start", "competitions"])
    expect(barAreas("USER")).toEqual(["start", "competitions", "profile"])
    expect(moreAreas("USER")).toEqual([])
  })
})

describe("barAreaOf", () => {
  it("was nicht in der Leiste steht, zeigt dort Profil", () => {
    expect(barAreaOf("disciplines", "ADMIN")).toBe("profile")
    expect(barAreaOf("admin", "ADMIN")).toBe("profile")
  })

  it("Einträge der Leiste bleiben, ohne Bereich keiner", () => {
    expect(barAreaOf("participants", "MANAGER")).toBe("participants")
    expect(barAreaOf("competitions", "USER")).toBe("competitions")
    expect(barAreaOf(null, "ADMIN")).toBeNull()
  })
})
