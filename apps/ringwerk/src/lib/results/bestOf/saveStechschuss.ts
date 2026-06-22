"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calculateRingteiler, MAX_RINGS } from "../calculateResult"
import { stechschussOutcome } from "@/lib/scoring/bestOf"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import type { SaveStechschussInput, PlainSeries } from "./types"
import { loadMatchup, resolveDisciplines, evaluateMatchState, toPlain } from "./shared"
import { persistSeriesPair } from "./persistSeriesPair"

/**
 * Records one Stechschuss round (both shooters) for a BEST_OF_SINGLE matchup.
 *
 * A Stechschuss is a single decimal shot that decides a level match. The shot
 * value is stored in `rings`; teiler/ringteiler are unused (stored as 0).
 * duelNumber is assigned after the last regular duel so the unique key stays
 * stable. The first Stechschuss gets regularMax + 1, subsequent rounds get
 * regularMax + 2, etc.
 *
 * When both sides already have a series for the same latest tiebreak
 * duelNumber, that round is treated as a correction and reuses that number.
 */
export async function saveStechschuss(input: SaveStechschussInput): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(input.matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  const { homeDiscipline, awayDiscipline } = await resolveDisciplines(matchup)
  if (!homeDiscipline || !awayDiscipline) return { error: "Disziplin nicht konfiguriert." }

  // Use home discipline FK; both participants share the same type in a Best-of league.
  const disciplineId = homeDiscipline.id
  const sessionDate = matchup.dueDate ?? new Date()

  // Determine the duelNumber to use for this Stechschuss.
  const regularSeries = matchup.series.filter((s) => !s.isTiebreak && s.duelNumber !== null)
  const maxRegularDuel = regularSeries.reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  const tiebreakSeries = matchup.series.filter((s) => s.isTiebreak && s.duelNumber !== null)

  // A correction reuses the duelNumber when both sides already have that round.
  const homeTbMax = tiebreakSeries
    .filter((s) => s.participantId === matchup.homeParticipantId)
    .reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)
  const awayTbMax = tiebreakSeries
    .filter((s) => s.participantId === matchup.awayParticipantId!)
    .reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  // If both sides have the same latest tiebreak duelNumber we need to decide:
  // was it a TIE (→ new round needed) or was it decided (→ correction of that round)?
  // A Stechschuss is decided purely by shot value (rings field), regardless of scoringMode.
  let latestTiebreakWasTie = false
  if (homeTbMax > 0 && homeTbMax === awayTbMax) {
    const homeTbSeries = tiebreakSeries.find(
      (s) => s.participantId === matchup.homeParticipantId && s.duelNumber === homeTbMax
    )
    const awayTbSeries = tiebreakSeries.find(
      (s) => s.participantId === matchup.awayParticipantId! && s.duelNumber === homeTbMax
    )
    if (homeTbSeries && awayTbSeries) {
      const outcome = stechschussOutcome(
        homeTbSeries.rings.toNumber(),
        awayTbSeries.rings.toNumber()
      )
      latestTiebreakWasTie = outcome === "TIE"
    }
  }

  // Correction: both sides have the same latest tiebreak duelNumber AND it was decided.
  // New round: the latest tiebreak was a tie (→ assign the next duelNumber).
  const isCorrection = homeTbMax > 0 && homeTbMax === awayTbMax && !latestTiebreakWasTie
  const tiebreakDuelNumber = isCorrection
    ? homeTbMax
    : Math.max(maxRegularDuel, homeTbMax, awayTbMax) + 1

  // Compute ringteiler for the Stechschuss shot so the RINGTEILER comparator
  // can rank them correctly: ringteiler = maxRings - shot + 0 (teiler unused).
  // Lower ringteiler = higher shot = better result.
  const homeMaxRings = MAX_RINGS[homeDiscipline.scoringType]
  const homeStechRingteiler = calculateRingteiler(input.homeShot, 0, 1, homeMaxRings)
  const awayMaxRings = MAX_RINGS[awayDiscipline.scoringType]
  const awayStechRingteiler = calculateRingteiler(input.awayShot, 0, 1, awayMaxRings)

  // Build updated series list (replace this tiebreak slot if correcting).
  const existingPlain = toPlain(matchup.series).filter(
    (s) => !(s.isTiebreak && s.duelNumber === tiebreakDuelNumber)
  )
  const updatedSeries: PlainSeries[] = [
    ...existingPlain,
    {
      participantId: matchup.homeParticipantId,
      rings: input.homeShot,
      teiler: 0,
      ringteiler: homeStechRingteiler,
      // teilerFaktor is irrelevant for tiebreaks (evaluated by stechschussOutcome).
      teilerFaktor: 1,
      duelNumber: tiebreakDuelNumber,
      isTiebreak: true,
    },
    {
      participantId: matchup.awayParticipantId!,
      rings: input.awayShot,
      teiler: 0,
      ringteiler: awayStechRingteiler,
      teilerFaktor: 1,
      duelNumber: tiebreakDuelNumber,
      isTiebreak: true,
    },
  ]

  const matchState = evaluateMatchState(
    matchup.homeParticipantId,
    matchup.awayParticipantId!,
    updatedSeries,
    matchup.competition.disciplineId,
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
      duelNumber: tiebreakDuelNumber,
      shotCount: 1,
      sessionDate,
      isTiebreak: true,
      recordedByUserId: session.user.id,
      newStatus,
      // Beim Stechschuss werden im Update nur rings/ringteiler aktualisiert.
      minimalUpdate: true,
      home: {
        participantId: matchup.homeParticipantId,
        disciplineId,
        rings: input.homeShot,
        teiler: 0,
        // Computed ringteiler so re-evaluation of stored series works correctly.
        ringteiler: homeStechRingteiler,
      },
      away: {
        participantId: matchup.awayParticipantId!,
        disciplineId,
        rings: input.awayShot,
        teiler: 0,
        ringteiler: awayStechRingteiler,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Stechschusses:", msg)
    return { error: "Stechschuss konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      // Reuse RESULT_ENTERED/RESULT_CORRECTED — no dedicated Stechschuss event yet.
      eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
      entityType: "MATCHUP",
      entityId: input.matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        duelNumber: tiebreakDuelNumber,
        isTiebreak: true,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        homeShot: input.homeShot,
        awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
        awayShot: input.awayShot,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}
