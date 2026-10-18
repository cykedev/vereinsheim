import { describe, expect, it } from "vitest"

import { assertPruefDatabaseUrl, pruefDatabaseUrl, PRUEF_DATABASE_NAME } from "./db"

describe("assertPruefDatabaseUrl", () => {
  it("nimmt eine lokale Datenbank, deren Name auf _pruef endet", () => {
    expect(
      assertPruefDatabaseUrl("postgresql://ringwerk:ringwerk@localhost:5432/ringwerk_pruef")
    ).toBe("ringwerk_pruef")
    expect(assertPruefDatabaseUrl("postgresql://u:p@127.0.0.1/x_pruef")).toBe("x_pruef")
  })

  it("verweigert die Dev-Datenbank mit der Kopie der echten Daten", () => {
    expect(() =>
      assertPruefDatabaseUrl("postgresql://ringwerk:ringwerk@localhost:5432/ringwerk")
    ).toThrow(/_pruef/)
  })

  it("verweigert Namen, die _pruef nur enthalten oder Zeichen außerhalb von [a-z0-9_] haben", () => {
    expect(() => assertPruefDatabaseUrl("postgresql://u:p@localhost/ringwerk_pruef_alt")).toThrow()
    expect(() => assertPruefDatabaseUrl('postgresql://u:p@localhost/a"b_pruef')).toThrow()
    expect(() => assertPruefDatabaseUrl("postgresql://u:p@localhost/")).toThrow()
  })

  it("verweigert Parameter, mit denen pg einen anderen Rechner nähme", () => {
    expect(() =>
      assertPruefDatabaseUrl(
        "postgresql://ringwerk:ringwerk@localhost:5432/ringwerk_pruef?host=db.example.com"
      )
    ).toThrow(/ohne Parameter/)
    expect(() =>
      assertPruefDatabaseUrl("postgresql://u:p@localhost/ringwerk_pruef?sslmode=disable")
    ).toThrow(/ohne Parameter/)
  })

  it("verweigert jeden anderen Rechner", () => {
    expect(() => assertPruefDatabaseUrl("postgresql://u:p@db:5432/ringwerk_pruef")).toThrow(
      /diesem Rechner/
    )
    expect(() =>
      assertPruefDatabaseUrl("postgresql://u:p@vps.example.org:5432/ringwerk_pruef")
    ).toThrow(/diesem Rechner/)
  })
})

describe("pruefDatabaseUrl", () => {
  it("nimmt ohne PRUEF_DATABASE_URL die lokale Prüfdatenbank", () => {
    expect(new URL(pruefDatabaseUrl({})).pathname).toBe(`/${PRUEF_DATABASE_NAME}`)
  })

  it("prüft auch eine gesetzte PRUEF_DATABASE_URL", () => {
    expect(() =>
      pruefDatabaseUrl({ PRUEF_DATABASE_URL: "postgresql://u:p@localhost/ringwerk" })
    ).toThrow()
  })
})
