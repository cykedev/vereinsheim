import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  userFindUniqueMock,
  userFindFirstMock,
  userCreateMock,
  userUpdateMock,
  userCountMock,
  auditLogCreateMock,
  bcryptHashMock,
  bcryptCompareMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  userCreateMock: vi.fn(),
  userUpdateMock: vi.fn(),
  userCountMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  bcryptCompareMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("bcryptjs", () => ({
  default: { hash: bcryptHashMock, compare: bcryptCompareMock },
}))
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
      findFirst: userFindFirstMock,
      create: userCreateMock,
      update: userUpdateMock,
      count: userCountMock,
    },
    auditLog: { create: auditLogCreateMock },
  },
}))

import { createUser, updateUser, setUserActive, changeOwnPassword } from "@/lib/users/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createUser ───────────────────────────────────────────────────────────────

describe("createUser", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(null)
    userCreateMock.mockResolvedValue({ id: "new1" })
    bcryptHashMock.mockResolvedValue("hashed-password")
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({
    name: "Max Mustermann",
    email: "max@example.com",
    tempPassword: "sicheresPasswort1",
    role: "USER",
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Validierungsfehler bei ungültiger E-Mail", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(
      null,
      makeFormData({
        name: "Test",
        email: "keineemail",
        tempPassword: "sicheresPasswort1",
        role: "USER",
      })
    )
    expect(result).toMatchObject({ error: { email: expect.any(Array) } })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei zu kurzem Passwort (< 12 Zeichen)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(
      null,
      makeFormData({
        name: "Test",
        email: "max@example.com",
        tempPassword: "kurzpw",
        role: "USER",
      })
    )
    expect(result).toMatchObject({ error: { tempPassword: expect.any(Array) } })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler bei bereits verwendeter E-Mail", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue({ id: "existing1" })
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ error: "Diese E-Mail-Adresse wird bereits verwendet." })
    expect(userCreateMock).not.toHaveBeenCalled()
  })

  it("erstellt User und schreibt auditLog USER_CREATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createUser(null, validFormData)
    expect(result).toEqual({ success: true })
    expect(userCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "max@example.com", role: "USER" }),
      })
    )
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_CREATED" }),
      })
    )
  })

  it("erstellt einen MANAGER-Nutzer", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    userCreateMock.mockResolvedValue({ id: "new1" })
    bcryptHashMock.mockResolvedValue("hashed")
    auditLogCreateMock.mockResolvedValue({})
    const result = await createUser(
      null,
      makeFormData({
        name: "Maria Manager",
        email: "manager@example.com",
        tempPassword: "sicheresPasswort1",
        role: "MANAGER",
      })
    )
    expect(result).toEqual({ success: true })
  })

  it("verweigert MANAGER das Anlegen von Nutzern", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await createUser(
      null,
      makeFormData({
        name: "X",
        email: "x@example.com",
        tempPassword: "sicheresPasswort1",
        role: "USER",
      })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })
})

// ─── updateUser ───────────────────────────────────────────────────────────────

describe("updateUser", () => {
  const existingUser = { id: "u3", role: "USER", isActive: true }
  const existingAdmin = { id: "u3", role: "ADMIN", isActive: true }

  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(existingUser)
    userFindFirstMock.mockResolvedValue(null)
    userUpdateMock.mockResolvedValue({})
    userCountMock.mockResolvedValue(2)
    bcryptHashMock.mockResolvedValue("new-hash")
    auditLogCreateMock.mockResolvedValue({})
  })

  const validFormData = makeFormData({
    name: "Max Update",
    email: "update@example.com",
    role: "USER",
    isActive: "true",
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn User nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("liefert Fehler bei E-Mail-Konflikt mit anderem User", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindFirstMock.mockResolvedValue({ id: "other" })
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ error: "Diese E-Mail-Adresse wird bereits verwendet." })
  })

  it("liefert Fehler wenn eigener Account deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u3", role: "ADMIN" } })
    const result = await updateUser(
      "u3",
      null,
      makeFormData({ name: "Test", email: "me@example.com", role: "ADMIN", isActive: "false" })
    )
    expect(result).toEqual({ error: "Du kannst deinen eigenen Account nicht deaktivieren." })
  })

  it("liefert Fehler wenn letzter aktiver Admin degradiert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(existingAdmin)
    userCountMock.mockResolvedValue(0)
    const result = await updateUser(
      "u3",
      null,
      makeFormData({ name: "Test", email: "admin@example.com", role: "USER", isActive: "true" })
    )
    expect(result).toEqual({
      error: "Der letzte aktive Administrator kann nicht degradiert oder deaktiviert werden.",
    })
  })

  it("aktualisiert User ohne Passwort-Reset und schreibt auditLog USER_UPDATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateUser("u3", null, validFormData)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u3" } }))
    expect(bcryptHashMock).not.toHaveBeenCalled()
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_UPDATED" }),
      })
    )
  })

  it("setzt neues passwordHash und incrementiert sessionVersion bei Passwort-Reset", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const fd = makeFormData({
      name: "Max",
      email: "update@example.com",
      role: "USER",
      isActive: "true",
      tempPassword: "neuesPasswort123",
    })
    const result = await updateUser("u3", null, fd)
    expect(result).toEqual({ success: true })
    expect(bcryptHashMock).toHaveBeenCalled()
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "new-hash",
          sessionVersion: { increment: 1 },
        }),
      })
    )
  })
})

// ─── setUserActive ────────────────────────────────────────────────────────────

describe("setUserActive", () => {
  const activeUser = {
    id: "u3",
    name: "Max",
    email: "max@example.com",
    role: "USER",
    isActive: true,
  }
  const inactiveUser = { ...activeUser, isActive: false }
  const activeAdmin = { ...activeUser, role: "ADMIN" }

  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue(activeUser)
    userUpdateMock.mockResolvedValue({})
    userCountMock.mockResolvedValue(2)
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn User nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("gibt success zurück ohne DB-Update wenn isActive bereits gleich dem Zielwert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeUser)
    const result = await setUserActive("u3", true)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn eigener Account deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u3", role: "ADMIN" } })
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ error: "Du kannst deinen eigenen Account nicht deaktivieren." })
  })

  it("liefert Fehler wenn letzter aktiver Admin deaktiviert werden soll", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeAdmin)
    userCountMock.mockResolvedValue(0)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({
      error: "Der letzte aktive Administrator kann nicht deaktiviert werden.",
    })
  })

  it("deaktiviert User und schreibt auditLog USER_DEACTIVATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(activeUser)
    const result = await setUserActive("u3", false)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u3" }, data: { isActive: false } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_DEACTIVATED" }),
      })
    )
  })

  it("reaktiviert User und schreibt auditLog USER_REACTIVATED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(inactiveUser)
    const result = await setUserActive("u3", true)
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u3" }, data: { isActive: true } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "USER_REACTIVATED" }),
      })
    )
  })
})

// ─── changeOwnPassword ────────────────────────────────────────────────────────

describe("changeOwnPassword", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    userFindUniqueMock.mockResolvedValue({ id: "u1", passwordHash: "old-hash" })
    bcryptCompareMock.mockResolvedValue(true)
    bcryptHashMock.mockResolvedValue("new-hash")
    userUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort123",
        confirmPassword: "neuesPasswort123",
      })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn Passwörter nicht übereinstimmen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort123",
        confirmPassword: "andresPasswort456",
      })
    )
    // validatePasswordChangeInput gibt String-Fehler zurück
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn User nicht in DB gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    userFindUniqueMock.mockResolvedValue(null)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ error: "Nutzer nicht gefunden." })
  })

  it("liefert Fehler bei falschem aktuellem Passwort", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    bcryptCompareMock.mockResolvedValue(false)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "falschesPasswort1",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ error: "Aktuelles Passwort ist falsch." })
  })

  it("setzt neues Passwort und incrementiert sessionVersion", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await changeOwnPassword(
      null,
      makeFormData({
        currentPassword: "altesPasswort123",
        newPassword: "neuesPasswort456",
        confirmPassword: "neuesPasswort456",
      })
    )
    expect(result).toEqual({ success: true })
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    })
  })
})
