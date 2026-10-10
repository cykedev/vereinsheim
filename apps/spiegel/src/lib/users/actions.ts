"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"

import { getAuthSession, isAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { BCRYPT_COST } from "@/lib/startup"
import type { ActionResult } from "@/lib/types"

import { accountChangeBlocked, CreateUserSchema, UpdateUserSchema } from "./rules"

// Kontenverwaltung für Admins, wie Ringwerk (ohne Protokoll, das kommt mit der Zuordnung, SP-1.7). Keine Ausnahme
// nach außen: jede Antwort ist ein ActionResult.

async function adminId(): Promise<string | ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }
  return session.user.id
}

export async function createUser(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await adminId()
  if (typeof actor !== "string") return actor

  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email"),
    tempPassword: formData.get("tempPassword"),
    role: formData.get("role"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const email = normalizeLoginEmail(parsed.data.email)
  if (!email) return { error: "Ungültige E-Mail-Adresse." }
  if (await db.user.findUnique({ where: { email }, select: { id: true } }))
    return { error: "Diese E-Mail-Adresse wird bereits verwendet." }

  await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.tempPassword, BCRYPT_COST),
      role: parsed.data.role,
    },
  })
  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateUser(
  id: string,
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await adminId()
  if (typeof actor !== "string") return actor

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  })
  if (!target) return { error: "Konto nicht gefunden." }
  const parsed = UpdateUserSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
    tempPassword: formData.get("tempPassword") ?? "",
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const email = normalizeLoginEmail(parsed.data.email)
  if (!email) return { error: "Ungültige E-Mail-Adresse." }
  if (await db.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } }))
    return { error: "Diese E-Mail-Adresse wird bereits verwendet." }

  const blocked = accountChangeBlocked({
    actorId: actor,
    target,
    next: { role: parsed.data.role, isActive: parsed.data.isActive },
    otherActiveAdmins: await db.user.count({
      where: { role: "ADMIN", isActive: true, NOT: { id } },
    }),
  })
  if (blocked) return { error: blocked }

  const { tempPassword } = parsed.data
  await db.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      // ein neues Passwort beendet alle Sitzungen des Kontos (sessionVersion)
      ...(tempPassword
        ? {
            passwordHash: await bcrypt.hash(tempPassword, BCRYPT_COST),
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
  })
  revalidatePath("/admin/users")
  return { success: true }
}
