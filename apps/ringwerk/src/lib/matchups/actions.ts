"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { generateSchedule } from "./generateSchedule"
import { generateBestOfSchedule } from "./generateBestOfSchedule"

/**
 * Generiert den Spielplan für einen aktiven Wettkampf.
 * Voraussetzungen:
 * - Wettkampf muss ACTIVE sein
 * - Mindestens 4 aktive Teilnehmer eingeschrieben
 * - Keine bereits abgeschlossenen Paarungen vorhanden
 *
 * Bestehende PENDING-Paarungen werden gelöscht und neu generiert.
 */
export async function generateCompetitionSchedule(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  // Wettkampf laden und Voraussetzungen prüfen
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      status: true,
      leagueFormat: true,
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
    },
  })
  if (!competition) return { error: "Liga nicht gefunden." }
  if (competition.status !== "ACTIVE") {
    return { error: "Spielplan kann nur für aktive Ligen generiert werden." }
  }

  // Aktive Teilnehmer laden
  const enrollments = await db.competitionParticipant.findMany({
    where: { competitionId, status: "ACTIVE" },
    select: { participantId: true },
    orderBy: { createdAt: "asc" },
  })

  if (enrollments.length < 4) {
    return {
      error: `Mindestens 4 aktive Teilnehmer erforderlich (aktuell: ${enrollments.length}).`,
    }
  }

  // Abgeschlossene Paarungen prüfen → Regenerierung verhindern
  const completedCount = await db.matchup.count({
    where: { competitionId, status: "COMPLETED" },
  })
  if (completedCount > 0) {
    return {
      error: `Spielplan kann nicht neu generiert werden — ${completedCount} Paarung(en) bereits abgeschlossen.`,
    }
  }

  // Spielplan berechnen
  const participantIds = enrollments.map((e) => e.participantId)

  type MatchupData = {
    competitionId: string
    homeParticipantId: string
    awayParticipantId: string | null
    round: "FIRST_LEG" | "SECOND_LEG"
    roundIndex: number
    status: "PENDING" | "BYE"
    dueDate: Date | null
  }

  let matchupData: MatchupData[]

  if (competition.leagueFormat === "BEST_OF_SINGLE") {
    const pairings = generateBestOfSchedule(participantIds)
    matchupData = pairings.map((m) => ({
      competitionId,
      homeParticipantId: m.homeId,
      awayParticipantId: m.awayId,
      round: "FIRST_LEG" as const,
      roundIndex: m.roundIndex,
      status: m.awayId === null ? ("BYE" as const) : ("PENDING" as const),
      dueDate: competition.hinrundeDeadline,
    }))
  } else {
    // DOUBLE_ROUND_ROBIN (default)
    const matchups = generateSchedule(participantIds)
    matchupData = matchups.map((m) => ({
      competitionId,
      homeParticipantId: m.homeId,
      awayParticipantId: m.awayId,
      round: m.round,
      roundIndex: m.roundIndex,
      status: m.awayId === null ? ("BYE" as const) : ("PENDING" as const),
      dueDate:
        m.round === "FIRST_LEG" ? competition.hinrundeDeadline : competition.rueckrundeDeadline,
    }))
  }

  // Transaktional: PENDING-Paarungen löschen + neue anlegen
  await db.$transaction([
    db.matchup.deleteMany({ where: { competitionId, status: "PENDING" } }),
    db.matchup.createMany({ data: matchupData }),
  ])

  revalidatePath(`/competitions/${competitionId}/schedule`)
  revalidatePath(`/competitions/${competitionId}/participants`)

  return { success: true }
}
