// Ein Konto aus Treffsicher, wie `tools/transfer/treffsicher-account.sql` es als eine Zeile JSON liefert. Das Schema
// prüft Form und Grenzen, bevor die Übernahme etwas damit tut; Kennungen und Pfade der Anhänge so eng, dass sie in
// `psql`-Variablen und Dateipfaden nichts anrichten können.

import { z } from "zod"

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)
const time = z.string().datetime({ offset: true })
const scale = z.number().int().min(0).max(100)
const seven = {
  fitness: scale,
  nutrition: scale,
  technique: scale,
  tactics: scale,
  mentalStrength: scale,
  environment: scale,
  equipment: scale,
}
const text = z.string().nullable()

/** ein Pfad im Upload-Ordner von Treffsicher: relativ, ohne `..`, nur einfache Zeichen (Treffsicher speichert UUIDs) */
const filePath = z
  .string()
  .regex(/^[A-Za-z0-9._/-]{1,200}$/)
  .refine(
    (path) =>
      !path.startsWith("/") && !path.split("/").some((part) => part === ".." || part === ""),
    {
      message: "Pfad außerhalb des Ordners",
    }
  )

export const treffsicherSession = z.object({
  id,
  date: time,
  type: z.enum(["TRAINING", "WETTKAMPF", "TROCKENTRAINING", "MENTAL"]),
  location: text,
  trainingGoal: text,
  isFavourite: z.boolean(),
  discipline: z
    .object({
      name: z.string(),
      scoringType: z.enum(["WHOLE", "TENTH"]),
      shotsPerSeries: z.number().int().min(1),
    })
    .nullable(),
  hitLocation: z
    .object({
      xMm: z.number(),
      yMm: z.number(),
      horizontal: z.enum(["LEFT", "RIGHT"]),
      vertical: z.enum(["HIGH", "LOW"]),
    })
    .nullable(),
  wellbeing: z.object({ sleep: scale, energy: scale, stress: scale, motivation: scale }).nullable(),
  prognosis: z
    .object({
      ...seven,
      expectedScore: z.number().nullable(),
      expectedCleanShots: z.number().int().nullable(),
      performanceGoal: text,
    })
    .nullable(),
  feedback: z
    .object({
      ...seven,
      explanation: text,
      goalAchieved: z.boolean().nullable(),
      goalAchievedNote: text,
      progress: text,
      fiveBestShots: text,
      wentWell: text,
      insights: text,
    })
    .nullable(),
  reflection: z
    .object({
      observations: text,
      insight: text,
      learningQuestion: text,
      routineDeviation: text,
    })
    .nullable(),
  series: z.array(
    z.object({
      position: z.number().int(),
      isPractice: z.boolean(),
      scoreTotal: z.number().nullable(),
      shots: z.array(z.string()).nullable(),
      executionQuality: z.number().int().min(1).max(5).nullable(),
    })
  ),
  attachments: z.array(
    z.object({
      id,
      filePath,
      fileType: z.enum(["IMAGE", "PDF"]),
      originalName: z.string(),
      createdAt: time,
    })
  ),
})

export const treffsicherGoal = z.object({
  id,
  title: z.string(),
  description: text,
  type: z.enum(["RESULT", "PROCESS"]),
  dateFrom: time,
  dateTo: time,
  sessionIds: z.array(id),
})

export const treffsicherRoutine = z.object({
  id,
  name: z.string(),
  discipline: z.object({ name: z.string() }).nullable(),
  /** wie gespeichert (`[{ order, title, description? }]`); geprüft erst beim Übernehmen, ein Fehler bricht nicht ab */
  steps: z.unknown(),
})

/** die Zeile JSON aus `tools/transfer/treffsicher-account.sql` */
export const treffsicherAccount = z.object({
  user: z.object({
    id,
    name: z.string().nullable(),
    email: z.string(),
    /** bcrypt wie in Spiegel; geht nur in den Speicher des Prozesses, nie in Ausgabe oder Bericht */
    passwordHash: z.string().min(1),
    isActive: z.boolean(),
    movedToSpiegelAt: time.nullable(),
  }),
  sessions: z.array(treffsicherSession),
  goals: z.array(treffsicherGoal),
  routines: z.array(treffsicherRoutine),
})

export type TreffsicherAccount = z.infer<typeof treffsicherAccount>
export type TreffsicherSession = TreffsicherAccount["sessions"][number]
export type TreffsicherGoal = TreffsicherAccount["goals"][number]
export type TreffsicherRoutine = TreffsicherAccount["routines"][number]
export type TreffsicherAttachment = TreffsicherSession["attachments"][number]
