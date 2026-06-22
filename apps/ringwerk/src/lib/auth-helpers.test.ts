import { describe, expect, it } from "vitest"
import { canManage, isAdmin } from "@/lib/auth-helpers"

describe("canManage", () => {
  it("gibt true für ADMIN zurück", () => {
    expect(canManage("ADMIN")).toBe(true)
  })

  it("gibt true für MANAGER zurück", () => {
    expect(canManage("MANAGER")).toBe(true)
  })

  it("gibt false für USER zurück", () => {
    expect(canManage("USER")).toBe(false)
  })

  it("gibt false für unbekannte Rolle zurück", () => {
    expect(canManage("")).toBe(false)
  })
})

describe("isAdmin", () => {
  it("gibt true für ADMIN zurück", () => {
    expect(isAdmin("ADMIN")).toBe(true)
  })

  it("gibt false für MANAGER zurück", () => {
    expect(isAdmin("MANAGER")).toBe(false)
  })

  it("gibt false für USER zurück", () => {
    expect(isAdmin("USER")).toBe(false)
  })

  it("gibt false für unbekannte Rolle zurück", () => {
    expect(isAdmin("")).toBe(false)
  })
})
