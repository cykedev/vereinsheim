"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { parseDate, revalidateCompetitionPaths, revalidatePublicSlug, BaseSchema } from "./_shared"
import { findActiveSlugConflict } from "../publicSlugQueries"

const CreateSchema = BaseSchema.extend({
  type: z.enum(["LEAGUE", "EVENT", "SEASON"], { message: "Ungültiger Wettbewerbstyp" }),
})

export async function createCompetition(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    scoringMode: formData.get("scoringMode"),
    shotsPerSeries: formData.get("shotsPerSeries"),
    disciplineId: formData.get("disciplineId"),
    hinrundeDeadline: formData.get("hinrundeDeadline"),
    rueckrundeDeadline: formData.get("rueckrundeDeadline"),
    eventDate: formData.get("eventDate"),
    allowGuests: formData.get("allowGuests"),
    teamSize: formData.get("teamSize"),
    teamScoring: formData.get("teamScoring"),
    targetValue: formData.get("targetValue"),
    targetValueType: formData.get("targetValueType"),
    minSeries: formData.get("minSeries"),
    seasonStart: formData.get("seasonStart"),
    seasonEnd: formData.get("seasonEnd"),
    playoffBestOf: formData.get("playoffBestOf"),
    playoffHasViertelfinale: formData.get("playoffHasViertelfinale"),
    playoffHasAchtelfinale: formData.get("playoffHasAchtelfinale"),
    finalePrimary: formData.get("finalePrimary"),
    finaleTiebreaker1: formData.get("finaleTiebreaker1"),
    finaleTiebreaker2: formData.get("finaleTiebreaker2"),
    finaleHasSuddenDeath: formData.get("finaleHasSuddenDeath"),
    leagueFormat: formData.get("leagueFormat"),
    groupBestOf: formData.get("groupBestOf"),
    groupPlayAllDuels: formData.get("groupPlayAllDuels"),
    groupTiebreaker1: formData.get("groupTiebreaker1"),
    groupTiebreaker2: formData.get("groupTiebreaker2"),
    groupHasSuddenDeath: formData.get("groupHasSuddenDeath"),
    isPublic: formData.get("isPublic"),
    publicSlug: formData.get("publicSlug"),
    publicPassword: formData.get("publicPassword"),
    removePublicPassword: formData.get("removePublicPassword"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { type, name, scoringMode, shotsPerSeries, disciplineId } = parsed.data

  if (disciplineId) {
    const discipline = await db.discipline.findUnique({
      where: { id: disciplineId },
      select: { id: true },
    })
    if (!discipline) return { error: "Disziplin nicht gefunden." }
  }

  // New competitions default to ACTIVE — check for slug collision immediately
  if (parsed.data.isPublic && parsed.data.publicSlug) {
    const conflict = await findActiveSlugConflict(parsed.data.publicSlug, null)
    if (conflict) {
      return {
        error: `Slug ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
      }
    }
  }

  // Hash password if provided; no existing hash to preserve on creation
  const publicPasswordHash =
    parsed.data.removePublicPassword || parsed.data.publicPassword == null
      ? null
      : await bcrypt.hash(parsed.data.publicPassword, 12)

  const competition = await db.competition.create({
    data: {
      name,
      type,
      scoringMode,
      shotsPerSeries,
      disciplineId,
      hinrundeDeadline: parseDate(parsed.data.hinrundeDeadline),
      rueckrundeDeadline: parseDate(parsed.data.rueckrundeDeadline),
      eventDate: parseDate(parsed.data.eventDate),
      allowGuests: type === "EVENT" ? parsed.data.allowGuests : null,
      teamSize: type === "EVENT" ? (parsed.data.teamSize ?? null) : null,
      teamScoring: type === "EVENT" ? (parsed.data.teamScoring ?? null) : null,
      targetValue: type === "EVENT" ? (parsed.data.targetValue ?? null) : null,
      targetValueType: type === "EVENT" ? (parsed.data.targetValueType ?? null) : null,
      minSeries: type === "SEASON" ? (parsed.data.minSeries ?? null) : null,
      seasonStart: type === "SEASON" ? parseDate(parsed.data.seasonStart) : null,
      seasonEnd: type === "SEASON" ? parseDate(parsed.data.seasonEnd) : null,
      playoffBestOf: type === "LEAGUE" ? (parsed.data.playoffBestOf ?? null) : null,
      playoffHasViertelfinale: type === "LEAGUE" ? parsed.data.playoffHasViertelfinale : undefined,
      playoffHasAchtelfinale: type === "LEAGUE" ? parsed.data.playoffHasAchtelfinale : undefined,
      finalePrimary: type === "LEAGUE" ? parsed.data.finalePrimary : undefined,
      finaleTiebreaker1: type === "LEAGUE" ? (parsed.data.finaleTiebreaker1 ?? null) : null,
      finaleTiebreaker2: type === "LEAGUE" ? (parsed.data.finaleTiebreaker2 ?? null) : null,
      finaleHasSuddenDeath: type === "LEAGUE" ? parsed.data.finaleHasSuddenDeath : null,
      // BEST_OF_SINGLE group-phase config — only meaningful for LEAGUE
      // groupPlayAllDuels DB default is false; explicitly set true for BEST_OF_SINGLE
      leagueFormat: type === "LEAGUE" ? parsed.data.leagueFormat : undefined,
      groupBestOf:
        type === "LEAGUE" && parsed.data.leagueFormat === "BEST_OF_SINGLE"
          ? (parsed.data.groupBestOf ?? 3)
          : undefined,
      groupPlayAllDuels:
        type === "LEAGUE" && parsed.data.leagueFormat === "BEST_OF_SINGLE"
          ? parsed.data.groupPlayAllDuels
          : undefined,
      groupTiebreaker1:
        type === "LEAGUE" && parsed.data.leagueFormat === "BEST_OF_SINGLE"
          ? (parsed.data.groupTiebreaker1 ?? null)
          : undefined,
      groupTiebreaker2:
        type === "LEAGUE" && parsed.data.leagueFormat === "BEST_OF_SINGLE"
          ? (parsed.data.groupTiebreaker2 ?? null)
          : undefined,
      groupHasSuddenDeath:
        type === "LEAGUE" && parsed.data.leagueFormat === "BEST_OF_SINGLE"
          ? parsed.data.groupHasSuddenDeath
          : undefined,
      isPublic: parsed.data.isPublic ?? false,
      publicSlug: parsed.data.publicSlug,
      publicPasswordHash,
      createdByUserId: session.user.id,
    },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_CREATED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: competition.id,
      userId: session.user.id,
      competitionId: competition.id,
      details: {
        name,
        type,
        scoringMode,
      },
    },
  })

  if (parsed.data.isPublic && parsed.data.publicSlug) {
    revalidatePublicSlug(parsed.data.publicSlug)
  }
  revalidateCompetitionPaths()
  return { success: true, data: { id: competition.id } }
}
