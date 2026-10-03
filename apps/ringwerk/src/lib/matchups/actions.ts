"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { generateSchedule } from "./generateSchedule"
import { generateBestOfSchedule } from "./generateBestOfSchedule"
import { getScheduleResultCounts } from "./queries"
import { scheduleRegenerationBlocker } from "./regeneration"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"

/**
 * Generiert den Spielplan für einen aktiven Wettkampf.
 * Voraussetzungen:
 * - Wettkampf muss ACTIVE sein
 * - Mindestens 4 aktive Teilnehmer eingeschrieben
 * - Noch kein Ergebnis erfasst (keine entschiedene Paarung, keine Serie, keine Playoffs)
 *
 * Bestehende offene Paarungen (PENDING) und Freilose (BYE) werden gelöscht und neu generiert.
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

  // Sperre, Löschen und Anlegen in EINER serialisierbaren Transaktion. Neu generieren nur ohne
  // jedes Ergebnis: eine Best-of-Paarung bleibt PENDING, bis alle Duelle entschieden sind, und
  // Series.matchupId steht auf ON DELETE SET NULL — ein Löschen ließe erfasste Serien still
  // verwaisen. `series: { none: {} }` sichert das zusätzlich am Löschbefehl selbst ab; ein parallel
  // gespeichertes Ergebnis führt zum Serialisierungsfehler statt zu Datenverlust.
  let blocker: string | null
  try {
    blocker = await db.$transaction(
      async (tx) => {
        const reason = scheduleRegenerationBlocker(await getScheduleResultCounts(competitionId, tx))
        if (reason) return reason
        // Offene Paarungen und Freilose (BYE) gehören zum alten Plan — blieben Freilose stehen,
        // hätte jeder Teilnehmer danach zwei je Runde.
        await tx.matchup.deleteMany({
          where: { competitionId, status: { in: ["PENDING", "BYE"] }, series: { none: {} } },
        })
        await tx.matchup.createMany({ data: matchupData })
        return null
      },
      { isolationLevel: "Serializable" }
    )
  } catch (error) {
    console.error("Spielplan-Generierung fehlgeschlagen:", error)
    return { error: "Spielplan konnte nicht generiert werden. Bitte erneut versuchen." }
  }
  if (blocker) return { error: blocker }

  revalidatePath(`/competitions/${competitionId}/schedule`)
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePublicPdf(competitionId)

  return { success: true }
}
