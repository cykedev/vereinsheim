"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import {
  finaleNeedsTeiler,
  isPlayoffMatchComplete,
  requiredWinsFromBestOf,
} from "../calculatePlayoffs"
import type { SavePlayoffDuelResultInput } from "../types"
import { computeDuelOutcome, storedDuelOutcome } from "./duelOutcome"
import {
  addExtraDuel,
  cascadeDeleteEmptyNextRound,
  hasNextRoundDuels,
  persistDuelResult,
} from "./duelMutations"

/**
 * Speichert das Ergebnis eines Playoff-Einzel-Duells.
 * Aktualisiert den Siegstand und schließt den PlayoffMatch ab wenn nötig.
 * Bei abgeschlossenem PlayoffMatch: erstellt automatisch die nächste Runde.
 * Bei Finale-Gleichstand: erstellt ein Sudden-Death-Duell.
 * Bei VF/HF-Unentschieden: legt automatisch das nächste Duell an.
 */
export async function savePlayoffDuelResult(
  input: SavePlayoffDuelResultInput
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const duel = await db.playoffDuel.findUnique({
    where: { id: input.duelId },
    select: {
      id: true,
      duelNumber: true,
      isCompleted: true,
      playoffMatchId: true,
      results: {
        select: {
          participantId: true,
          totalRings: true,
          teiler: true,
          ringteiler: true,
        },
      },
      playoffMatch: {
        select: {
          id: true,
          round: true,
          winsA: true,
          winsB: true,
          status: true,
          competitionId: true,
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
          competition: {
            select: {
              disciplineId: true,
              discipline: { select: { scoringType: true, teilerFaktor: true } },
              playoffBestOf: true,
              finalePrimary: true,
              finaleTiebreaker1: true,
              finaleTiebreaker2: true,
              finaleHasSuddenDeath: true,
            },
          },
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const isCorrection = duel.isCompleted
  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"
  const wasMatchComplete = match.status === "COMPLETED"
  const finalePrimary = match.competition.finalePrimary
  const finaleTiebreaker1 = match.competition.finaleTiebreaker1 ?? null
  const finaleTiebreaker2 = match.competition.finaleTiebreaker2 ?? null
  const finaleHasSuddenDeath = match.competition.finaleHasSuddenDeath ?? true
  const requiredWins = requiredWinsFromBestOf(match.competition.playoffBestOf)
  const finaleTeilerNeeded =
    isFinal && finaleNeedsTeiler(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)

  // Korrektur nur erlaubt wenn Folge-Runde noch keine Duelle hat
  if (isCorrection && !isFinal && (await hasNextRoundDuels(match))) {
    return {
      error: "Korrektur nicht möglich — in der nächsten Runde wurden bereits Duelle gespielt.",
    }
  }

  // Finale: Kette primary → tb1 → tb2; VF/HF: Ringteiler-Berechnung
  const computed = await computeDuelOutcome(
    match,
    input,
    isFinal,
    finaleTeilerNeeded,
    finalePrimary,
    finaleTiebreaker1,
    finaleTiebreaker2
  )
  if ("error" in computed) return { error: computed.error }
  const { ringteilerA, ringteilerB, outcome } = computed

  // Siege neu berechnen: bei Korrektur alten Outcome subtrahieren, neuen addieren
  let newWinsA = match.winsA
  let newWinsB = match.winsB
  if (isCorrection) {
    const oldResultA = duel.results.find((r) => r.participantId === match.participantAId)
    const oldResultB = duel.results.find((r) => r.participantId === match.participantBId)
    if (oldResultA && oldResultB) {
      const oldOutcome = storedDuelOutcome(
        oldResultA,
        oldResultB,
        isFinal,
        finalePrimary,
        finaleTiebreaker1,
        finaleTiebreaker2
      )
      if (oldOutcome === "A") newWinsA--
      else if (oldOutcome === "B") newWinsB--
    }
  }
  if (outcome === "A") newWinsA++
  else if (outcome === "B") newWinsB++

  const matchComplete =
    outcome !== "DRAW" && isPlayoffMatchComplete(newWinsA, newWinsB, match.round, requiredWins)
  const saveTeiler = !isFinal || finaleTeilerNeeded
  const teilerA = saveTeiler ? (input.teilerA ?? null) : null
  const teilerB = saveTeiler ? (input.teilerB ?? null) : null

  try {
    await persistDuelResult({
      duelId: input.duelId,
      matchId: match.id,
      recordedByUserId: session.user.id,
      newWinsA,
      newWinsB,
      matchComplete,
      a: {
        participantId: match.participantAId,
        totalRings: input.totalRingsA,
        teiler: teilerA,
        ringteiler: ringteilerA,
      },
      b: {
        participantId: match.participantBId,
        totalRings: input.totalRingsB,
        teiler: teilerB,
        ringteiler: ringteilerB,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Playoff-Ergebnisses:", msg)
    return { error: "Ergebnis konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      eventType: isCorrection ? "PLAYOFF_RESULT_CORRECTED" : "PLAYOFF_RESULT_ENTERED",
      entityType: "PLAYOFF_DUEL",
      entityId: input.duelId,
      userId: session.user.id,
      competitionId: match.competitionId,
      details: {
        duelId: input.duelId,
        matchId: match.id,
        round: match.round,
        duelNumber: duel.duelNumber,
        nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
        nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
        totalRingsA: input.totalRingsA,
        teilerA,
        totalRingsB: input.totalRingsB,
        teilerB,
      },
    },
  })

  // Nach der Transaktion: Folge-Aktionen
  if (outcome === "DRAW" && !isCorrection) {
    if (isFinal) {
      // Finale-Gleichstand → Sudden-Death-Duell anlegen (wenn finaleHasSuddenDeath)
      if (finaleHasSuddenDeath) {
        await addExtraDuel(match.id, true)
      }
    } else {
      // VF/HF-Unentschieden → nächstes Duell automatisch anlegen
      await addExtraDuel(match.id, false)
    }
  }

  // Wenn Korrektur ein abgeschlossenes Match wieder öffnet → leere Folge-Runden-Matches löschen
  if (isCorrection && wasMatchComplete && !matchComplete && !isFinal) {
    await cascadeDeleteEmptyNextRound(match)
  }

  // The playoffs route is refreshed client-side via router.refresh(); only the
  // public slug is revalidated here (a separate route, no refresh conflict).
  await revalidatePublicSlugForCompetition(match.competitionId)
  return { success: true }
}
