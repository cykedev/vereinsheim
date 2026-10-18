import { describe, expect, it } from "vitest"

import { isLocalDatabase } from "./pruefen-account"

describe("isLocalDatabase", () => {
  it("nur eine Datenbank auf diesem Rechner", () => {
    expect(isLocalDatabase("postgresql://u:p@localhost:5432/treffsicher")).toBe(true)
    expect(isLocalDatabase("postgresql://u:p@127.0.0.1/treffsicher")).toBe(true)
    expect(isLocalDatabase("postgresql://u:p@db:5432/treffsicher")).toBe(false)
    expect(isLocalDatabase("postgresql://u:p@localhost.example.org/treffsicher")).toBe(false)
    expect(isLocalDatabase(undefined)).toBe(false)
    expect(isLocalDatabase("kein url")).toBe(false)
  })
})
