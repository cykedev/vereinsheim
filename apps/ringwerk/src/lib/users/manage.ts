"use server"

import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getAuthSession, isAdmin } from "@/lib/auth-helpers"
import { normalizeLoginEmail, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/authValidation"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { BCRYPT_COST, CreateUserSchema, UpdateUserSchema, revalidateUserPaths } from "./_shared"

export async function createUser(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    tempPassword: formData.get("tempPassword"),
    role: formData.get("role"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const email = normalizeLoginEmail(parsed.data.email)
  if (!email) return { error: "Ungültige E-Mail-Adresse." }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: "Diese E-Mail-Adresse wird bereits verwendet." }

  const passwordHash = await bcrypt.hash(parsed.data.tempPassword, BCRYPT_COST)
  const newUser = await db.user.create({
    data: { name: parsed.data.name, email, passwordHash, role: parsed.data.role },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "USER_CREATED" satisfies AuditEventType,
      entityType: "USER",
      entityId: newUser.id,
      userId: session.user.id,
      details: {
        fullName: parsed.data.name ?? null,
        email,
        role: parsed.data.role,
      },
    },
  })

  revalidateUserPaths()
  return { success: true }
}

export async function updateUser(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  })
  if (!user) return { error: "Nutzer nicht gefunden." }

  const parsed = UpdateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const email = normalizeLoginEmail(parsed.data.email)
  if (!email) return { error: "Ungültige E-Mail-Adresse." }

  const emailConflict = await db.user.findFirst({
    where: { email, NOT: { id } },
    select: { id: true },
  })
  if (emailConflict) return { error: "Diese E-Mail-Adresse wird bereits verwendet." }

  // Eigenen Account nicht deaktivieren
  if (id === session.user.id && !parsed.data.isActive) {
    return { error: "Du kannst deinen eigenen Account nicht deaktivieren." }
  }

  // Letzten aktiven Admin schützen
  if (user.role === "ADMIN" && (parsed.data.role !== "ADMIN" || !parsed.data.isActive)) {
    const adminCount = await db.user.count({
      where: { role: "ADMIN", isActive: true, NOT: { id } },
    })
    if (adminCount === 0) {
      return {
        error: "Der letzte aktive Administrator kann nicht degradiert oder deaktiviert werden.",
      }
    }
  }

  // Optionaler Passwort-Reset
  const tempPassword = String(formData.get("tempPassword") ?? "").trim()
  const updateData: Record<string, unknown> = {
    name: parsed.data.name,
    email,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
  }

  if (tempPassword.length > 0) {
    if (tempPassword.length < MIN_PASSWORD_LENGTH) {
      return { error: `Neues Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` }
    }
    if (tempPassword.length > MAX_PASSWORD_LENGTH) {
      return { error: "Passwort ist zu lang." }
    }
    updateData.passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST)
    updateData.sessionVersion = { increment: 1 }
  }

  await db.user.update({ where: { id }, data: updateData })

  await db.auditLog.create({
    data: {
      eventType: "USER_UPDATED" satisfies AuditEventType,
      entityType: "USER",
      entityId: id,
      userId: session.user.id,
      details: {
        fullName: parsed.data.name ?? null,
        email,
        role: parsed.data.role,
      },
    },
  })

  revalidateUserPaths()
  return { success: true }
}

export async function setUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  if (!user) return { error: "Nutzer nicht gefunden." }

  if (user.isActive === isActive) return { success: true }

  if (id === session.user.id && !isActive) {
    return { error: "Du kannst deinen eigenen Account nicht deaktivieren." }
  }

  if (!isActive && user.role === "ADMIN") {
    const adminCount = await db.user.count({
      where: { role: "ADMIN", isActive: true, NOT: { id } },
    })
    if (adminCount === 0) {
      return { error: "Der letzte aktive Administrator kann nicht deaktiviert werden." }
    }
  }

  await db.user.update({ where: { id }, data: { isActive } })

  const eventType: AuditEventType = isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED"
  await db.auditLog.create({
    data: {
      eventType,
      entityType: "USER",
      entityId: id,
      userId: session.user.id,
      details: {
        fullName: user.name ?? null,
        email: user.email,
      },
    },
  })

  revalidateUserPaths()
  return { success: true }
}
