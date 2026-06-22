"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calculateRingteiler, MAX_RINGS } from "../calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import type { SaveBestOfDuelInput, PlainSeries } from "./types"
import { loadMatchup, resolveDisciplines, evaluateMatchState, toPlain } from "./shared"
import { persistSeriesPair } from "./persistSeriesPair"

/**
 * Records one duel (both shooters' series) for a BEST_OF_SINGLE matchup.
 *
 * Discipline resolution, ringteiler computation, and the upsert transaction
 * mirror saveMatchResult exactly. After writing, the match state is
 * re-evaluated using all series including the newly supplied values; if the
 * best-of is decided the matchup is set to COMPLETED.
 */
export async function saveBestOfDuel(input: SaveBestOfDuelInput): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(input.matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  const { homeDiscipline, awayDiscipline } = await resolveDisciplines(matchup)
  if (!homeDiscipline || !awayDiscipline) return { error: "Disziplin nicht konfiguriert." }

  const competitionDisciplineId = matchup.competition.disciplineId
  const homeFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    homeDiscipline.teilerFaktor.toNumber()
  )
  const awayFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    awayDiscipline.teilerFaktor.toNumber()
  )

  const homeRingteiler = calculateRingteiler(
    input.homeResult.rings,
    input.homeResult.teiler,
    homeFaktor,
    MAX_RINGS[homeDiscipline.scoringType]
  )
  const awayRingteiler = calculateRingteiler(
    input.awayResult.rings,
    input.awayResult.teiler,
    awayFaktor,
    MAX_RINGS[awayDiscipline.scoringType]
  )

  const sessionDate = matchup.dueDate ?? new Date()
  const shotCount = input.homeResult.shots?.length ?? matchup.competition.shotsPerSeries

  // Determine if this specific duel number already has series (correction).
  const existingForDuel = matchup.series.filter((s) => s.duelNumber === input.duelNumber)
  const isCorrection = existingForDuel.length > 0

  // Build the full series list including the new values to re-evaluate state.
  const existingPlain = toPlain(matchup.series).filter((s) => s.duelNumber !== input.duelNumber)
  const updatedSeries: PlainSeries[] = [
    ...existingPlain,
    {
      participantId: matchup.homeParticipantId,
      rings: input.homeResult.rings,
      teiler: input.homeResult.teiler,
      ringteiler: homeRingteiler,
      // Raw (uncorrected) factor: evaluateMatchState applies effectiveTeilerFaktor itself.
      teilerFaktor: homeDiscipline.teilerFaktor.toNumber(),
      duelNumber: input.duelNumber,
      isTiebreak: false,
    },
    {
      participantId: matchup.awayParticipantId!,
      rings: input.awayResult.rings,
      teiler: input.awayResult.teiler,
      ringteiler: awayRingteiler,
      teilerFaktor: awayDiscipline.teilerFaktor.toNumber(),
      duelNumber: input.duelNumber,
      isTiebreak: false,
    },
  ]

  const matchState = evaluateMatchState(
    matchup.homeParticipantId,
    matchup.awayParticipantId!,
    updatedSeries,
    competitionDisciplineId,
    matchup.competition.scoringMode,
    matchup.competition.groupTiebreaker1 ?? null,
    matchup.competition.groupTiebreaker2 ?? null,
    matchup.competition.groupBestOf ?? 3,
    matchup.competition.groupPlayAllDuels
  )
  const newStatus = matchState.kind === "complete" ? "COMPLETED" : "PENDING"

  try {
    await persistSeriesPair({
      matchupId: input.matchupId,
      duelNumber: input.duelNumber,
      shotCount,
      sessionDate,
      isTiebreak: false,
      recordedByUserId: session.user.id,
      newStatus,
      minimalUpdate: false,
      home: {
        participantId: matchup.homeParticipantId,
        disciplineId: homeDiscipline.id,
        rings: input.homeResult.rings,
        teiler: input.homeResult.teiler,
        ringteiler: homeRingteiler,
      },
      away: {
        participantId: matchup.awayParticipantId!,
        disciplineId: awayDiscipline.id,
        rings: input.awayResult.rings,
        teiler: input.awayResult.teiler,
        ringteiler: awayRingteiler,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Best-of-Duells:", msg)
    return { error: "Duell-Ergebnis konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
      entityType: "MATCHUP",
      entityId: input.matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        duelNumber: input.duelNumber,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        homeRings: input.homeResult.rings,
        homeTeiler: input.homeResult.teiler,
        awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
        awayRings: input.awayResult.rings,
        awayTeiler: input.awayResult.teiler,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}
