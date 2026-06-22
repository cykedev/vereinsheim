import { revalidatePath } from "next/cache"
import { z } from "zod"

export const ParticipantSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich").max(100, "Vorname zu lang"),
  lastName: z.string().min(1, "Nachname ist erforderlich").max(100, "Nachname zu lang"),
  contact: z
    .string()
    .max(255, "Kontakt zu lang")
    .nullable()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
})

export function revalidateParticipantPaths(): void {
  revalidatePath("/participants")
  revalidatePath("/participants", "layout")
}
