"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { getStandingsForCompetition } from "@/lib/standings/queries"
import { createFirstRoundMatchups } from "../calculatePlayoffs"
import { revalidatePublicSlug } from "@/lib/competitions/actions/_shared"

/**
 * Startet die Playoff-Phase für eine Liga.
 * Erstellt die erste Runde (VF oder HF) basierend auf der aktuellen Tabelle.
 *
 * Voraussetzungen:
 * - Meisterschaft muss ACTIVE sein
 * - Playoffs noch nicht gestartet
 * - ≥ 4 aktive (nicht zurückgezogene) Teilnehmer
 * - Keine PENDING-Paarungen in der Gruppenphase
 */
export async function startPlayoffs(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      status: true,
      playoffBestOf: true,
      playoffHasViertelfinale: true,
      playoffHasAchtelfinale: true,
      isPublic: true,
      publicSlug: true,
    },
  })
  if (!competition) return { error: "Meisterschaft nicht gefunden." }
  if (competition.status !== "ACTIVE")
    return { error: "Playoffs können nur für aktive Meisterschaften gestartet werden." }

  const [existingCount, pendingCount] = await Promise.all([
    db.playoffMatch.count({ where: { competitionId } }),
    db.matchup.count({ where: { competitionId, status: "PENDING" } }),
  ])

  if (existingCount > 0) return { error: "Playoffs wurden bereits gestartet." }
  if (pendingCount > 0) return { error: "Es gibt noch ausstehende Paarungen in der Gruppenphase." }

  const standings = await getStandingsForCompetition(competitionId)
  const activeStandings = standings.filter((r) => !r.withdrawn)

  const minRequired = competition.playoffHasAchtelfinale
    ? 16
    : competition.playoffHasViertelfinale
      ? 8
      : 4
  if (activeStandings.length < minRequired) {
    return { error: `Mindestens ${minRequired} aktive Teilnehmer für Playoffs erforderlich.` }
  }

  const matchups = createFirstRoundMatchups(standings, {
    playoffHasViertelfinale: competition.playoffHasViertelfinale,
    playoffHasAchtelfinale: competition.playoffHasAchtelfinale,
  })

  try {
    await db.playoffMatch.createMany({
      data: matchups.map((m) => ({
        competitionId,
        round: m.round,
        participantAId: m.participantAId,
        participantBId: m.participantBId,
      })),
    })

    await db.auditLog.create({
      data: {
        eventType: "PLAYOFFS_STARTED",
        entityType: "COMPETITION",
        entityId: competitionId,
        userId: session.user.id,
        competitionId,
        details: { participantCount: activeStandings.length },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Starten der Playoffs:", msg)
    return { error: "Playoffs konnten nicht gestartet werden." }
  }

  // Invalidate the public PDF cache — the Liga PDF switches from Spielplan to Playoffs view
  revalidatePublicSlug(competition.publicSlug)

  revalidatePath(`/competitions/${competitionId}/playoffs`)
  return { success: true }
}
