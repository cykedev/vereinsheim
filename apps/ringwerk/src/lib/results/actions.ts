"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { SaveMatchResultInput } from "./types"
import { calculateRingteiler, MAX_RINGS } from "./calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"

/**
 * Speichert das Ergebnis einer Paarung (beide Schützen).
 * Bestehende Ergebnisse werden überschrieben (Korrektur) → AuditLog-Eintrag.
 * Ab Phase 3: teilerFaktor wird in die Ringteiler-Berechnung einbezogen.
 */
export async function saveMatchResult(
  matchupId: string,
  data: SaveMatchResultInput
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await db.matchup.findUnique({
    where: { id: matchupId },
    select: {
      id: true,
      status: true,
      round: true,
      dueDate: true,
      homeParticipantId: true,
      homeParticipant: { select: { firstName: true, lastName: true } },
      awayParticipantId: true,
      awayParticipant: { select: { firstName: true, lastName: true } },
      competitionId: true,
      competition: {
        select: {
          shotsPerSeries: true,
          disciplineId: true,
          discipline: {
            select: { id: true, scoringType: true, teilerFaktor: true },
          },
        },
      },
      series: { select: { id: true } },
    },
  })

  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  // Disziplin per Teilnehmer auflösen (unterstützt gemischte Wettbewerbe)
  let homeDiscipline = matchup.competition.discipline
  let awayDiscipline = matchup.competition.discipline

  if (!homeDiscipline) {
    const [homeCp, awayCp] = await Promise.all([
      db.competitionParticipant.findFirst({
        where: { participantId: matchup.homeParticipantId, competitionId: matchup.competitionId },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
      db.competitionParticipant.findFirst({
        where: { participantId: matchup.awayParticipantId!, competitionId: matchup.competitionId },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
    ])
    homeDiscipline = homeCp?.discipline ?? null
    awayDiscipline = awayCp?.discipline ?? null
  }

  if (!homeDiscipline || !awayDiscipline) {
    return { error: "Disziplin nicht konfiguriert." }
  }

  const homeMaxRings = MAX_RINGS[homeDiscipline.scoringType]
  const awayMaxRings = MAX_RINGS[awayDiscipline.scoringType]
  const competitionDisciplineId = matchup.competition.disciplineId
  const homeFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    homeDiscipline.teilerFaktor.toNumber()
  )
  const awayFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    awayDiscipline.teilerFaktor.toNumber()
  )
  const sessionDate = matchup.dueDate ?? new Date()
  const shotCount = matchup.competition.shotsPerSeries

  const homeRingteiler = calculateRingteiler(
    data.homeResult.rings,
    data.homeResult.teiler,
    homeFaktor,
    homeMaxRings
  )
  const awayRingteiler = calculateRingteiler(
    data.awayResult.rings,
    data.awayResult.teiler,
    awayFaktor,
    awayMaxRings
  )

  const isCorrection = matchup.series.length > 0

  try {
    await db.$transaction(async (tx) => {
      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId,
            participantId: matchup.homeParticipantId,
            duelNumber: 1,
          },
        },
        create: {
          matchupId,
          participantId: matchup.homeParticipantId,
          disciplineId: homeDiscipline.id,
          shotCount,
          sessionDate,
          rings: data.homeResult.rings,
          teiler: data.homeResult.teiler,
          ringteiler: homeRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: 1,
        },
        update: {
          disciplineId: homeDiscipline.id,
          shotCount,
          sessionDate,
          rings: data.homeResult.rings,
          teiler: data.homeResult.teiler,
          ringteiler: homeRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId,
            participantId: matchup.awayParticipantId!,
            duelNumber: 1,
          },
        },
        create: {
          matchupId,
          participantId: matchup.awayParticipantId!,
          disciplineId: awayDiscipline.id,
          shotCount,
          sessionDate,
          rings: data.awayResult.rings,
          teiler: data.awayResult.teiler,
          ringteiler: awayRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: 1,
        },
        update: {
          disciplineId: awayDiscipline.id,
          shotCount,
          sessionDate,
          rings: data.awayResult.rings,
          teiler: data.awayResult.teiler,
          ringteiler: awayRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.matchup.update({
        where: { id: matchupId },
        data: { status: "COMPLETED" },
      })
    })

    await db.auditLog.create({
      data: {
        eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
        entityType: "MATCHUP",
        entityId: matchupId,
        userId: session.user.id,
        competitionId: matchup.competitionId,
        details: {
          round: matchup.round,
          homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
          homeRings: data.homeResult.rings,
          homeTeiler: data.homeResult.teiler,
          awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
          awayRings: data.awayResult.rings,
          awayTeiler: data.awayResult.teiler,
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Ergebnisses:", msg)
    return { error: "Ergebnis konnte nicht gespeichert werden." }
  }

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}
