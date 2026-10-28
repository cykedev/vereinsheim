"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"

import { Prisma } from "@/generated/prisma/client"
import { getAuthSession, isAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { BCRYPT_COST } from "@/lib/startup"
import type { ActionResult } from "@/lib/types"

import { accountChangeBlocked, CreateUserSchema, UpdateUserSchema } from "./rules"

// Kontenverwaltung für Admins, wie Ringwerk (ohne Protokoll). Keine Ausnahme
// nach außen: jede Antwort ist ein ActionResult.

const EMAIL_TAKEN = "Diese E-Mail-Adresse hat schon ein anderes Konto."

/** Prisma-Fehlercode, wenn es einer ist */
const prismaCode = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null

async function adminId(): Promise<string | ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Das geht gerade nicht. Lade die Seite neu." }
  if (!isAdmin(session.user.role)) return { error: "Das darf nur ein Admin." }
  if (session.user.mustChangePassword) return { error: "Bitte zuerst das eigene Passwort ändern." }
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
  if (!email) return { error: "Bitte eine gültige E-Mail-Adresse eingeben." }
  if (await db.user.findUnique({ where: { email }, select: { id: true } }))
    return { error: EMAIL_TAKEN }

  try {
    await db.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash: await bcrypt.hash(parsed.data.tempPassword, BCRYPT_COST),
        role: parsed.data.role,
        // das Passwort kennt der Admin: bei der ersten Anmeldung ersetzen
        mustChangePassword: true,
      },
    })
  } catch (error) {
    // zwei gleichzeitige Anfragen mit derselben E-Mail: die zweite scheitert am eindeutigen Schlüssel
    if (prismaCode(error) === "P2002") return { error: EMAIL_TAKEN }
    throw error
  }
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
  if (!target) return { error: "Dieses Konto gibt es nicht mehr." }
  const parsed = UpdateUserSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
    tempPassword: formData.get("tempPassword") ?? "",
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  const email = normalizeLoginEmail(parsed.data.email)
  if (!email) return { error: "Bitte eine gültige E-Mail-Adresse eingeben." }
  if (await db.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } }))
    return { error: EMAIL_TAKEN }

  const { tempPassword } = parsed.data
  // vor der Transaktion: bcrypt dauert, die Transaktion soll kurz bleiben
  const passwordHash = tempPassword ? await bcrypt.hash(tempPassword, BCRYPT_COST) : null
  // neues Passwort, neue Rolle oder neuer Status beenden die Sitzungen des Kontos: Das JWT trägt die Rolle, und ein
  // herabgestuftes Konto käme sonst mit der alten noch durch proxy.ts
  const endSessions =
    !!passwordHash || parsed.data.role !== target.role || parsed.data.isActive !== target.isActive
  try {
    // Prüfen und Ändern in einer Transaktion (Konventionen §9): Zwei Admins, die sich gleichzeitig herabstufen, sähen
    // sonst beide noch einen anderen aktiven Admin
    const blocked = await db.$transaction(
      async (tx) => {
        // dieselbe Sperre wie „Konto löschen“ (`deleteAccountIn`): Ein Admin, der sich gerade löscht, hält diese Zeilen,
        // und ohne sie zählte diese Transaktion ihn noch mit
        await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" ORDER BY id FOR UPDATE`
        const blocked = accountChangeBlocked({
          actorId: actor,
          target,
          next: { role: parsed.data.role, isActive: parsed.data.isActive },
          otherActiveAdmins: await tx.user.count({
            where: { role: "ADMIN", isActive: true, NOT: { id } },
          }),
        })
        if (blocked) return blocked
        await tx.user.update({
          where: { id },
          data: {
            name: parsed.data.name,
            email,
            role: parsed.data.role,
            isActive: parsed.data.isActive,
            ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
            ...(endSessions ? { sessionVersion: { increment: 1 } } : {}),
          },
        })
        return null
      },
      { isolationLevel: "Serializable" }
    )
    if (blocked) return { error: blocked }
  } catch (error) {
    const code = prismaCode(error)
    if (code === "P2002") return { error: EMAIL_TAKEN }
    if (code === "P2034")
      return {
        error: "Gleichzeitig wurde ein anderes Konto geändert. Bitte noch einmal speichern.",
      }
    throw error
  }
  revalidatePath("/admin/users")
  return { success: true }
}
