import { z } from "zod"

import {
  MAX_PASSWORD_LENGTH,
  MAX_USER_EMAIL_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@vereinsheim/lib/auth/validation"

/** Rollen in Spiegel: Admin verwaltet Konten (sieht keine fremden Schüsse), Schütze sieht seine Scheiben */
export const ROLES = ["USER", "ADMIN"] as const
export type Role = (typeof ROLES)[number]

const name = z
  .string()
  .max(100)
  .transform((v) => v.trim() || null)
const email = z
  .string()
  .trim()
  .email({ message: "Ungültige E-Mail-Adresse" })
  .max(MAX_USER_EMAIL_LENGTH)
const role = z.enum(ROLES, { message: "Ungültige Rolle" })

export const CreateUserSchema = z.object({
  name,
  email,
  tempPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`)
    .max(MAX_PASSWORD_LENGTH, "Passwort ist zu lang"),
  role,
})

export const UpdateUserSchema = z.object({
  name,
  email,
  role,
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
  // nicht getrimmt, wie beim Anlegen und bei der Anmeldung: ein Leerzeichen am Rand gehört zum Passwort; leer heißt kein
  // Wechsel
  tempPassword: z
    .string()
    .refine((v) => v.length === 0 || v.length >= MIN_PASSWORD_LENGTH, {
      message: `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`,
    })
    .refine((v) => v.length <= MAX_PASSWORD_LENGTH, { message: "Passwort ist zu lang" }),
})

/**
 * Was eine Änderung an einem Konto nicht darf (wie Ringwerk): das eigene Konto deaktivieren, den letzten aktiven Admin
 * herabstufen oder deaktivieren. Gibt die Meldung zurück oder null.
 */
export function accountChangeBlocked(input: {
  actorId: string
  target: { id: string; role: string; isActive: boolean }
  next: { role: string; isActive: boolean }
  /** aktive Admins außer dem Ziel */
  otherActiveAdmins: number
}): string | null {
  const { actorId, target, next, otherActiveAdmins } = input
  if (target.id === actorId && !next.isActive)
    return "Du kannst dein eigenes Konto nicht deaktivieren."
  const losesAdmin = next.role !== "ADMIN" || !next.isActive
  if (target.role === "ADMIN" && target.isActive && losesAdmin && otherActiveAdmins === 0)
    return "Der letzte aktive Admin kann nicht herabgestuft oder deaktiviert werden."
  return null
}
