import { db } from "@/lib/db"
import { calculateRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import {
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  finaleNeedsTeiler,
} from "../calculatePlayoffs"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"

/** Persistiertes Ergebnis einer Seite (Decimal-Felder als Prisma-Decimal). */
interface StoredResult {
  totalRings: { toNumber(): number }
  teiler: { toNumber(): number } | null
  ringteiler: { toNumber(): number } | null
}

/**
 * Bestimmt den zuvor gewerteten Outcome eines bereits gespeicherten Duells.
 * Wird bei Korrekturen genutzt, um den alten Siegbeitrag rückzurechnen.
 * Verhalten identisch zum vorherigen Inline-Block in savePlayoffDuelResult.
 */
export function storedDuelOutcome(
  oldResultA: StoredResult,
  oldResultB: StoredResult,
  isFinal: boolean,
  finalePrimary: ScoringMode,
  finaleTiebreaker1: ScoringMode | null,
  finaleTiebreaker2: ScoringMode | null
): "A" | "B" | "DRAW" {
  if (isFinal && !finaleNeedsTeiler(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)) {
    return determineFinaleRoundWinner(
      oldResultA.totalRings.toNumber(),
      oldResultB.totalRings.toNumber(),
      finalePrimary,
      undefined,
      undefined,
      undefined,
      undefined,
      finaleTiebreaker1,
      finaleTiebreaker2
    )
  }
  return determinePlayoffDuelWinner(
    oldResultA.ringteiler?.toNumber() ?? 0,
    oldResultA.totalRings.toNumber(),
    oldResultA.teiler?.toNumber() ?? 0,
    oldResultB.ringteiler?.toNumber() ?? 0,
    oldResultB.totalRings.toNumber(),
    oldResultB.teiler?.toNumber() ?? 0
  )
}

interface DuelMatchContext {
  participantAId: string
  participantBId: string
  competitionId: string
  competition: {
    disciplineId: string | null
    discipline: { scoringType: ScoringType; teilerFaktor: { toNumber(): number } } | null
  }
}

interface ComputeOutcomeInput {
  totalRingsA: number
  totalRingsB: number
  teilerA?: number | null
  teilerB?: number | null
}

interface ComputeOutcomeResult {
  ringteilerA: number | null
  ringteilerB: number | null
  outcome: "A" | "B" | "DRAW"
}

/**
 * Berechnet Ringteiler und Outcome eines Playoff-Duells.
 *
 * - Finale ohne Teiler-Bedarf: Outcome direkt aus Ringen (ringteiler bleibt null).
 * - Sonst: Disziplin je Teilnehmer auflösen (gemischte Wettbewerbe), Ringteiler
 *   berechnen und Outcome via Finale- bzw. Standard-Vergleich bestimmen.
 *
 * Verhalten identisch zum vorherigen Inline-Block in savePlayoffDuelResult.
 */
export async function computeDuelOutcome(
  match: DuelMatchContext,
  input: ComputeOutcomeInput,
  isFinal: boolean,
  finaleTeilerNeeded: boolean,
  finalePrimary: ScoringMode,
  finaleTiebreaker1: ScoringMode | null,
  finaleTiebreaker2: ScoringMode | null
): Promise<{ error: string } | ComputeOutcomeResult> {
  if (isFinal && !finaleTeilerNeeded) {
    const outcome = determineFinaleRoundWinner(
      input.totalRingsA,
      input.totalRingsB,
      finalePrimary,
      undefined,
      undefined,
      undefined,
      undefined,
      finaleTiebreaker1,
      finaleTiebreaker2
    )
    return { ringteilerA: null, ringteilerB: null, outcome }
  }

  // Disziplin per Teilnehmer auflösen (unterstützt gemischte Wettbewerbe)
  let disciplineA = match.competition.discipline
  let disciplineB = match.competition.discipline

  if (!disciplineA) {
    const [cpA, cpB] = await Promise.all([
      db.competitionParticipant.findFirst({
        where: { participantId: match.participantAId, competitionId: match.competitionId },
        select: { discipline: { select: { scoringType: true, teilerFaktor: true } } },
      }),
      db.competitionParticipant.findFirst({
        where: { participantId: match.participantBId, competitionId: match.competitionId },
        select: { discipline: { select: { scoringType: true, teilerFaktor: true } } },
      }),
    ])
    disciplineA = cpA?.discipline ?? null
    disciplineB = cpB?.discipline ?? null
  }

  if (!disciplineA || !disciplineB) return { error: "Disziplin nicht konfiguriert." }

  const maxRingsA = MAX_RINGS[disciplineA.scoringType]
  const maxRingsB = MAX_RINGS[disciplineB.scoringType]
  const competitionDisciplineId = match.competition.disciplineId
  const ringteilerA = calculateRingteiler(
    input.totalRingsA,
    input.teilerA ?? 0,
    effectiveTeilerFaktor(competitionDisciplineId, disciplineA.teilerFaktor.toNumber()),
    maxRingsA
  )
  const ringteilerB = calculateRingteiler(
    input.totalRingsB,
    input.teilerB ?? 0,
    effectiveTeilerFaktor(competitionDisciplineId, disciplineB.teilerFaktor.toNumber()),
    maxRingsB
  )

  const outcome = isFinal
    ? determineFinaleRoundWinner(
        input.totalRingsA,
        input.totalRingsB,
        finalePrimary,
        ringteilerA,
        input.teilerA ?? 0,
        ringteilerB,
        input.teilerB ?? 0,
        finaleTiebreaker1,
        finaleTiebreaker2
      )
    : determinePlayoffDuelWinner(
        ringteilerA,
        input.totalRingsA,
        input.teilerA ?? 0,
        ringteilerB,
        input.totalRingsB,
        input.teilerB ?? 0
      )

  return { ringteilerA, ringteilerB, outcome }
}
