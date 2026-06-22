"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { getStandingsForCompetition } from "@/lib/standings/queries"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import { createNextRoundMatchups, getNextRound } from "../calculatePlayoffs"
import type { PlayoffRound } from "../types"

/**
 * Setzt manuell die nächste Runde an, wenn alle Matches der aktuellen Runde abgeschlossen sind.
 * Nur Admin; ersetzt das frühere automatische Seeding.
 */
export async function advanceRound(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matches = await db.playoffMatch.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
    },
  })

  if (matches.length === 0) return { error: "Keine Playoffs gefunden." }

  // Höchste Runde ohne Folge-Runde ermitteln
  const hasEF = matches.some((m) => m.round === "EIGHTH_FINAL")
  const hasQF = matches.some((m) => m.round === "QUARTER_FINAL")
  const hasSF = matches.some((m) => m.round === "SEMI_FINAL")
  const hasFinal = matches.some((m) => m.round === "FINAL")

  let roundToAdvance: PlayoffRound | null = null
  if (hasEF && !hasQF) {
    roundToAdvance = "EIGHTH_FINAL"
  } else if (hasQF && !hasSF) {
    roundToAdvance = "QUARTER_FINAL"
  } else if (hasSF && !hasFinal) {
    roundToAdvance = "SEMI_FINAL"
  }

  if (!roundToAdvance) return { error: "Keine Runde zum Anlegen der nächsten Runde." }

  const currentRoundMatches = matches.filter((m) => m.round === roundToAdvance)
  if (!currentRoundMatches.every((m) => m.status === "COMPLETED")) {
    return { error: "Noch nicht alle Matches der aktuellen Runde abgeschlossen." }
  }

  await handleMatchCompletion(currentRoundMatches[0].id, competitionId, roundToAdvance)

  revalidatePath(`/competitions/${competitionId}/playoffs`)
  await revalidatePublicSlugForCompetition(competitionId)
  return { success: true }
}

/**
 * Nach Abschluss eines PlayoffMatch: prüft ob alle Matches der Runde done sind.
 * Falls ja → nächste Runde erstellen.
 * Bei FINAL → keine weitere Runde.
 */
async function handleMatchCompletion(
  matchId: string,
  competitionId: string,
  round: PlayoffRound
): Promise<void> {
  if (round === "FINAL") return

  const allMatchesInRound = await db.playoffMatch.findMany({
    where: { competitionId, round },
    select: {
      id: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
    },
  })

  const allComplete = allMatchesInRound.every((m) => m.status === "COMPLETED")
  if (!allComplete) return

  const winners = allMatchesInRound.map((m) =>
    m.winsA > m.winsB ? m.participantAId : m.participantBId
  )

  const nextRound = getNextRound(round)!

  if (nextRound === "FINAL") {
    await db.playoffMatch.create({
      data: {
        competitionId,
        round: "FINAL",
        participantAId: winners[0],
        participantBId: winners[1],
      },
    })
    return
  }

  // Re-Seeding nach Original-Gruppenrang
  const standings = await getStandingsForCompetition(competitionId)
  const rankMap = new Map(standings.map((s) => [s.participantId, s.rank]))
  const nextMatchups = createNextRoundMatchups(winners, rankMap)

  await db.playoffMatch.createMany({
    data: nextMatchups.map((m) => ({
      competitionId,
      round: nextRound,
      participantAId: m.participantAId,
      participantBId: m.participantBId,
    })),
  })
}
