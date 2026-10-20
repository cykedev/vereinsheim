"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"
import { finaleNeedsTeiler } from "../calculatePlayoffs"
import type { SavePlayoffDuelResultInput } from "../types"
import { computeDuelOutcome, duelFactors } from "./duelOutcome"
import { playoffFailureMessage, recordDuelResult } from "./duelMutations"

/**
 * Speichert das Ergebnis eines Playoff-Einzel-Duells (neu oder als Korrektur).
 * Siegstand und Status zählt `recordDuelResult` in der Transaktion aus den Duellen. Ändert eine Korrektur den Ausgang,
 * entfällt die ganze nächste Runde (sie wird über `advanceRound` neu gesetzt).
 * Finale offen ohne offenes Duell: Sudden-Death-Duell (mit `finaleHasSuddenDeath`).
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
      playoffMatch: {
        select: {
          id: true,
          round: true,
          competitionId: true,
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
          competition: {
            select: {
              disciplineId: true,
              shotsPerSeries: true,
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

  const match = { ...duel.playoffMatch, factors: await duelFactors(duel.playoffMatch) }
  const isFinal = match.round === "FINAL"
  const rules = {
    playoffBestOf: match.competition.playoffBestOf,
    finalePrimary: match.competition.finalePrimary,
    finaleTiebreaker1: match.competition.finaleTiebreaker1 ?? null,
    finaleTiebreaker2: match.competition.finaleTiebreaker2 ?? null,
    finaleHasSuddenDeath: match.competition.finaleHasSuddenDeath,
  }
  const finaleTeilerNeeded =
    isFinal &&
    finaleNeedsTeiler(rules.finalePrimary, rules.finaleTiebreaker1, rules.finaleTiebreaker2)

  // Finale: Kette primary → tb1 → tb2; VF/HF: Ringteiler-Berechnung
  const computed = await computeDuelOutcome(
    match,
    input,
    isFinal,
    finaleTeilerNeeded,
    rules.finalePrimary,
    rules.finaleTiebreaker1,
    rules.finaleTiebreaker2
  )
  if ("error" in computed) return { error: computed.error }
  const { ringteilerA, ringteilerB, outcome } = computed

  const saveTeiler = !isFinal || finaleTeilerNeeded
  const teilerA = saveTeiler ? (input.teilerA ?? null) : null
  const teilerB = saveTeiler ? (input.teilerB ?? null) : null

  // Siegstand, Status, nächstes Duell und Folge-Runde ergeben sich in der Transaktion aus den Duellen
  try {
    await recordDuelResult({
      duelId: input.duelId,
      match,
      rules,
      recordedByUserId: session.user.id,
      outcome,
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
      audit: (isCorrection) => ({
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
      }),
    })
  } catch (error) {
    return { error: playoffFailureMessage(error, "Ergebnis konnte nicht gespeichert werden.") }
  }

  // The playoffs route is refreshed client-side via router.refresh(); only the
  // public slug is revalidated here (a separate route, no refresh conflict).
  revalidatePublicPdf(match.competitionId)
  return { success: true }
}
