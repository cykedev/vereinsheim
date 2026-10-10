import { describe, expect, it } from "vitest"

import { accountChangeBlocked, CreateUserSchema, UpdateUserSchema } from "./rules"

describe("accountChangeBlocked", () => {
  const admin = { id: "a", role: "ADMIN", isActive: true }
  it("das eigene Konto nicht deaktivieren", () => {
    expect(
      accountChangeBlocked({
        actorId: "a",
        target: admin,
        next: { role: "ADMIN", isActive: false },
        otherActiveAdmins: 3,
      })
    ).toMatch(/eigenes Konto/)
  })
  it("den letzten aktiven Admin weder herabstufen noch deaktivieren; mit einem zweiten geht es", () => {
    const base = { actorId: "x", target: admin }
    expect(
      accountChangeBlocked({
        ...base,
        next: { role: "USER", isActive: true },
        otherActiveAdmins: 0,
      })
    ).toMatch(/letzte aktive Admin/)
    expect(
      accountChangeBlocked({
        ...base,
        next: { role: "ADMIN", isActive: false },
        otherActiveAdmins: 0,
      })
    ).toMatch(/letzte aktive Admin/)
    expect(
      accountChangeBlocked({
        ...base,
        next: { role: "USER", isActive: true },
        otherActiveAdmins: 1,
      })
    ).toBeNull()
  })
  it("Schützen ändern ist frei; ein inaktiver Admin ist nicht der letzte", () => {
    expect(
      accountChangeBlocked({
        actorId: "x",
        target: { id: "u", role: "USER", isActive: true },
        next: { role: "USER", isActive: false },
        otherActiveAdmins: 0,
      })
    ).toBeNull()
    expect(
      accountChangeBlocked({
        actorId: "x",
        target: { id: "b", role: "ADMIN", isActive: false },
        next: { role: "USER", isActive: false },
        otherActiveAdmins: 0,
      })
    ).toBeNull()
  })
})

describe("Schemas", () => {
  it("Anlegen: Passwort ab 12 Zeichen, nur Admin oder Schütze", () => {
    const ok = { name: " ", email: "a@b.de", tempPassword: "x".repeat(12), role: "USER" }
    expect(CreateUserSchema.parse(ok)).toMatchObject({ name: null, role: "USER" })
    expect(CreateUserSchema.safeParse({ ...ok, tempPassword: "kurz" }).success).toBe(false)
    expect(CreateUserSchema.safeParse({ ...ok, role: "MANAGER" }).success).toBe(false)
  })
  it("Ändern: Passwort leer heißt kein Wechsel, sonst ab 12 Zeichen", () => {
    const ok = { name: "A", email: "a@b.de", role: "ADMIN", isActive: "false", tempPassword: "" }
    expect(UpdateUserSchema.parse(ok)).toMatchObject({ isActive: false, tempPassword: "" })
    expect(UpdateUserSchema.safeParse({ ...ok, tempPassword: "kurz" }).success).toBe(false)
    // nicht getrimmt, wie Anlegen und Anmeldung
    expect(UpdateUserSchema.parse({ ...ok, tempPassword: " lang-genug-123 " }).tempPassword).toBe(
      " lang-genug-123 "
    )
  })
})
