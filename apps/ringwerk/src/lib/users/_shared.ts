import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USER_EMAIL_LENGTH,
} from "@/lib/authValidation"

export const BCRYPT_COST = 12

export const CreateUserSchema = z.object({
  name: z
    .string()
    .max(100)
    .transform((v) => v.trim() || null),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse" }).max(MAX_USER_EMAIL_LENGTH),
  tempPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`)
    .max(MAX_PASSWORD_LENGTH),
  role: z.enum(["ADMIN", "MANAGER", "USER"] as const, { message: "Ungültige Rolle" }),
})

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .max(100)
    .transform((v) => v.trim() || null),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse" }).max(MAX_USER_EMAIL_LENGTH),
  role: z.enum(["ADMIN", "MANAGER", "USER"] as const, { message: "Ungültige Rolle" }),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
})

export function revalidateUserPaths(): void {
  revalidatePath("/admin/users")
  revalidatePath("/admin/users", "layout")
}
