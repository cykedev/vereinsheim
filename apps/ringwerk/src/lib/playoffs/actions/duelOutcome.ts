import { db } from "@/lib/db"
import { calculateRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { calculateCorrectedTeiler, effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
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

/** Teiler-Faktor je Seite eines Duells: der der Disziplin im gemischten Wettbewerb, sonst 1 (`effectiveTeilerFaktor`) */
export interface DuelFactors {
  a: number
  b: number
}

/**
 * Bestimmt den Ausgang eines gespeicherten Duells, mit dem Ringwerk die Siege zählt und den Sieger im Turnierbaum
 * markiert. Beim Teiler zählt der korrigierte (Teiler × Faktor); der gespeicherte Ringteiler enthält ihn schon.
 */
export function storedDuelOutcome(
  oldResultA: StoredResult,
  oldResultB: StoredResult,
  isFinal: boolean,
  finalePrimary: ScoringMode,
  finaleTiebreaker1: ScoringMode | null,
  finaleTiebreaker2: ScoringMode | null,
  factors: DuelFactors
): "A" | "B" | "DRAW" {
  const teilerA = calculateCorrectedTeiler(oldResultA.teiler?.toNumber() ?? 0, factors.a)
  const teilerB = calculateCorrectedTeiler(oldResultB.teiler?.toNumber() ?? 0, factors.b)
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
  // dieselbe Regel wie `computeDuelOutcome`: im Finale die Kette des Finales, sonst Ringteiler, Ringe, Teiler
  if (isFinal) {
    return determineFinaleRoundWinner(
      oldResultA.totalRings.toNumber(),
      oldResultB.totalRings.toNumber(),
      finalePrimary,
      oldResultA.ringteiler?.toNumber() ?? 0,
      teilerA,
      oldResultB.ringteiler?.toNumber() ?? 0,
      teilerB,
      finaleTiebreaker1,
      finaleTiebreaker2
    )
  }
  return determinePlayoffDuelWinner(
    oldResultA.ringteiler?.toNumber() ?? 0,
    oldResultA.totalRings.toNumber(),
    teilerA,
    oldResultB.ringteiler?.toNumber() ?? 0,
    oldResultB.totalRings.toNumber(),
    teilerB
  )
}

interface DuelDiscipline {
  scoringType: ScoringType
  teilerFaktor: { toNumber(): number }
}

interface DuelMatchContext {
  participantAId: string
  participantBId: string
  competitionId: string
  competition: {
    disciplineId: string | null
    discipline: DuelDiscipline | null
  }
}

/** Disziplin je Seite: die des Wettbewerbs, im gemischten Wettbewerb die der Einschreibung */
async function duelDisciplines(
  match: DuelMatchContext
): Promise<{ a: DuelDiscipline | null; b: DuelDiscipline | null }> {
  const fixed = match.competition.discipline
  if (fixed) return { a: fixed, b: fixed }
  const [cpA, cpB] = await Promise.all(
    [match.participantAId, match.participantBId].map((participantId) =>
      db.competitionParticipant.findFirst({
        where: { participantId, competitionId: match.competitionId },
        select: { discipline: { select: { scoringType: true, teilerFaktor: true } } },
      })
    )
  )
  return { a: cpA?.discipline ?? null, b: cpB?.discipline ?? null }
}

/**
 * Teiler-Faktoren eines Duells für `storedDuelOutcome`. Bei fester Disziplin 1; im gemischten Wettbewerb der Faktor
 * der Disziplin der Einschreibung (ohne Disziplin 1, wie beim Teiler vom Ausdruck).
 */
export async function duelFactors(match: DuelMatchContext): Promise<DuelFactors> {
  if (match.competition.disciplineId !== null) return { a: 1, b: 1 }
  const { a, b } = await duelDisciplines(match)
  return { a: a?.teilerFaktor.toNumber() ?? 1, b: b?.teilerFaktor.toNumber() ?? 1 }
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
  const { a: disciplineA, b: disciplineB } = await duelDisciplines(match)
  if (!disciplineA || !disciplineB) return { error: "Disziplin nicht konfiguriert." }

  const maxRingsA = MAX_RINGS[disciplineA.scoringType]
  const maxRingsB = MAX_RINGS[disciplineB.scoringType]
  const competitionDisciplineId = match.competition.disciplineId
  const factorA = effectiveTeilerFaktor(
    competitionDisciplineId,
    disciplineA.teilerFaktor.toNumber()
  )
  const factorB = effectiveTeilerFaktor(
    competitionDisciplineId,
    disciplineB.teilerFaktor.toNumber()
  )
  const ringteilerA = calculateRingteiler(input.totalRingsA, input.teilerA ?? 0, factorA, maxRingsA)
  const ringteilerB = calculateRingteiler(input.totalRingsB, input.teilerB ?? 0, factorB, maxRingsB)
  // beim Teiler zählt der korrigierte, wie im Ringteiler
  const teilerA = calculateCorrectedTeiler(input.teilerA ?? 0, factorA)
  const teilerB = calculateCorrectedTeiler(input.teilerB ?? 0, factorB)

  const outcome = isFinal
    ? determineFinaleRoundWinner(
        input.totalRingsA,
        input.totalRingsB,
        finalePrimary,
        ringteilerA,
        teilerA,
        ringteilerB,
        teilerB,
        finaleTiebreaker1,
        finaleTiebreaker2
      )
    : determinePlayoffDuelWinner(
        ringteilerA,
        input.totalRingsA,
        teilerA,
        ringteilerB,
        input.totalRingsB,
        teilerB
      )

  return { ringteilerA, ringteilerB, outcome }
}
