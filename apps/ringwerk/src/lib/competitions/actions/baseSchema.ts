import { z } from "zod"
import { LeagueFormat, ScoringMode, TeamScoring, TargetValueType } from "@/generated/prisma/client"
import { SLUG_REGEX } from "../publicSlug"

const PLAYOFF_SCORING_MODES = ["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"] as const

// BEST_OF_SINGLE only supports modes where a single duel yields a clear numeric result.
// DECIMAL_REST and TARGET_* modes are not defined for head-to-head duels.
const BEST_OF_SINGLE_SCORING_MODES = ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"] as const

export const BaseSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
    scoringMode: z.nativeEnum(ScoringMode, {
      message: "Ungültiger Wertungsmodus",
    }),
    shotsPerSeries: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 10))
      .pipe(z.number().min(1).max(100)),
    disciplineId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v !== "mixed" ? v : null)),
    isPublic: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    publicSlug: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
    // Plaintext password — never persisted as-is. Empty string / null = "leave existing hash alone"
    publicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    // "Passwort entfernen" checkbox — if true, clear the hash regardless of publicPassword
    removePublicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    // Liga
    hinrundeDeadline: z.string().nullable().optional(),
    rueckrundeDeadline: z.string().nullable().optional(),
    // Event
    eventDate: z.string().nullable().optional(),
    allowGuests: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    teamSize: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    teamScoring: z
      .nativeEnum(TeamScoring)
      .nullable()
      .optional()
      .transform((v) => v || null),
    targetValue: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseFloat(v.replace(",", ".")) : null)),
    targetValueType: z
      .nativeEnum(TargetValueType)
      .nullable()
      .optional()
      .transform((v) => v || null),
    // Saison
    minSeries: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    seasonStart: z.string().nullable().optional(),
    seasonEnd: z.string().nullable().optional(),
    // Liga – Regelset
    playoffBestOf: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    playoffHasViertelfinale: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    playoffHasAchtelfinale: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    finalePrimary: z.preprocess(
      (v) => (!v || v === "" ? "RINGS" : v),
      z.enum(PLAYOFF_SCORING_MODES)
    ),
    finaleTiebreaker1: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(PLAYOFF_SCORING_MODES).nullable()
    ),
    finaleTiebreaker2: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(PLAYOFF_SCORING_MODES).nullable()
    ),
    finaleHasSuddenDeath: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    // Liga – BEST_OF_SINGLE group-phase config
    leagueFormat: z.preprocess(
      (v) => (!v || v === "" ? "DOUBLE_ROUND_ROBIN" : v),
      z.nativeEnum(LeagueFormat)
    ),
    groupBestOf: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    groupPlayAllDuels: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    groupTiebreaker1: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(BEST_OF_SINGLE_SCORING_MODES).nullable()
    ),
    groupTiebreaker2: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(BEST_OF_SINGLE_SCORING_MODES).nullable()
    ),
    groupHasSuddenDeath: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
  })
  .superRefine((data, ctx) => {
    if (data.finaleTiebreaker2 && !data.finaleTiebreaker1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tiebreaker 2 setzt Tiebreaker 1 voraus",
        path: ["finaleTiebreaker2"],
      })
    }

    // BEST_OF_SINGLE-specific validation
    if (data.leagueFormat === "BEST_OF_SINGLE") {
      // groupBestOf must be an odd integer ≥ 1 (default 3)
      const bestOf = data.groupBestOf ?? 3
      if (bestOf < 1 || bestOf % 2 === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Best-of-Zahl muss eine ungerade ganze Zahl ≥ 1 sein (z.B. 1, 3, 5, 7)",
          path: ["groupBestOf"],
        })
      }

      // scoringMode restricted to the four head-to-head modes
      const allowedModes: readonly string[] = BEST_OF_SINGLE_SCORING_MODES
      if (!allowedModes.includes(data.scoringMode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Im Best-of-Modus ist nur Ringteiler, Ringe, Zehntelringe oder Teiler als Wertungsmodus erlaubt",
          path: ["scoringMode"],
        })
      }
    }

    if (data.isPublic) {
      if (!data.publicSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slug ist erforderlich, wenn 'Auf Vereins-Website veröffentlichen' aktiv ist",
          path: ["publicSlug"],
        })
      } else if (!SLUG_REGEX.test(data.publicSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche",
          path: ["publicSlug"],
        })
      }
    }
    if (
      data.publicPassword !== null &&
      data.publicPassword !== undefined &&
      data.publicPassword.length < 4
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwort muss mindestens 4 Zeichen haben",
        path: ["publicPassword"],
      })
    }
  })
