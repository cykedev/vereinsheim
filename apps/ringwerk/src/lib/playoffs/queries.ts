import { db } from "@/lib/db"
import { determineFinaleRoundWinner, determinePlayoffDuelWinner } from "./calculatePlayoffs"
import type { PlayoffBracketData, PlayoffDuelItem, PlayoffMatchItem, PlayoffRound } from "./types"

function mapDuelItem(
  duel: {
    id: string
    duelNumber: number
    isSuddenDeath: boolean
    isCompleted: boolean
    results: {
      participantId: string
      totalRings: { toNumber: () => number }
      teiler: { toNumber: () => number } | null
      ringteiler: { toNumber: () => number } | null
    }[]
  },
  participantAId: string,
  participantBId: string,
  round: PlayoffRound
): PlayoffDuelItem {
  const rawA = duel.results.find((r) => r.participantId === participantAId)
  const rawB = duel.results.find((r) => r.participantId === participantBId)

  const resultA = rawA
    ? {
        totalRings: rawA.totalRings.toNumber(),
        teiler: rawA.teiler?.toNumber() ?? null,
        ringteiler: rawA.ringteiler?.toNumber() ?? null,
      }
    : null

  const resultB = rawB
    ? {
        totalRings: rawB.totalRings.toNumber(),
        teiler: rawB.teiler?.toNumber() ?? null,
        ringteiler: rawB.ringteiler?.toNumber() ?? null,
      }
    : null

  let winnerId: string | null = null
  if (resultA && resultB) {
    const outcome =
      round === "FINAL"
        ? determineFinaleRoundWinner(resultA.totalRings, resultB.totalRings)
        : determinePlayoffDuelWinner(
            resultA.ringteiler!,
            resultA.totalRings,
            resultA.teiler!,
            resultB.ringteiler!,
            resultB.totalRings,
            resultB.teiler!
          )
    if (outcome === "A") winnerId = participantAId
    else if (outcome === "B") winnerId = participantBId
  }

  return {
    id: duel.id,
    duelNumber: duel.duelNumber,
    isSuddenDeath: duel.isSuddenDeath,
    isCompleted: duel.isCompleted,
    resultA,
    resultB,
    winnerId,
  }
}

function mapMatchItem(raw: {
  id: string
  round: PlayoffRound
  status: "PENDING" | "COMPLETED" | "BYE" | "WALKOVER"
  winsA: number
  winsB: number
  participantA: { id: string; firstName: string; lastName: string }
  participantB: { id: string; firstName: string; lastName: string }
  duels: {
    id: string
    duelNumber: number
    isSuddenDeath: boolean
    isCompleted: boolean
    results: {
      participantId: string
      totalRings: { toNumber: () => number }
      teiler: { toNumber: () => number } | null
      ringteiler: { toNumber: () => number } | null
    }[]
  }[]
}): PlayoffMatchItem {
  return {
    id: raw.id,
    round: raw.round,
    status: raw.status,
    winsA: raw.winsA,
    winsB: raw.winsB,
    participantA: raw.participantA,
    participantB: raw.participantB,
    duels: raw.duels.map((d) =>
      mapDuelItem(d, raw.participantA.id, raw.participantB.id, raw.round)
    ),
    canCorrect: false, // wird in getPlayoffBracket korrekt gesetzt
  }
}

/** Lädt alle Playoff-Paarungen einer Meisterschaft, gruppiert nach Runde. */
export async function getPlayoffBracket(competitionId: string): Promise<PlayoffBracketData> {
  const matches = await db.playoffMatch.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      status: true,
      winsA: true,
      winsB: true,
      participantA: { select: { id: true, firstName: true, lastName: true } },
      participantB: { select: { id: true, firstName: true, lastName: true } },
      duels: {
        orderBy: { duelNumber: "asc" },
        select: {
          id: true,
          duelNumber: true,
          isSuddenDeath: true,
          isCompleted: true,
          results: {
            select: {
              participantId: true,
              totalRings: true,
              teiler: true,
              ringteiler: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const base = matches.map(mapMatchItem)

  // canCorrect: FINAL immer; alle anderen Runden nur wenn Folge-Runde noch keine Duelle hat
  const qfIdsWithDuels = new Set(
    base
      .filter((m) => m.round === "QUARTER_FINAL" && m.duels.length > 0)
      .flatMap((m) => [m.participantA.id, m.participantB.id])
  )
  const sfIdsWithDuels = new Set(
    base
      .filter((m) => m.round === "SEMI_FINAL" && m.duels.length > 0)
      .flatMap((m) => [m.participantA.id, m.participantB.id])
  )
  const finalIdsWithDuels = new Set(
    base
      .filter((m) => m.round === "FINAL" && m.duels.length > 0)
      .flatMap((m) => [m.participantA.id, m.participantB.id])
  )

  const mapped = base.map((m) => ({
    ...m,
    canCorrect:
      m.round === "FINAL"
        ? true
        : m.round === "SEMI_FINAL"
          ? !finalIdsWithDuels.has(m.participantA.id) && !finalIdsWithDuels.has(m.participantB.id)
          : m.round === "QUARTER_FINAL"
            ? !sfIdsWithDuels.has(m.participantA.id) && !sfIdsWithDuels.has(m.participantB.id)
            : !qfIdsWithDuels.has(m.participantA.id) && !qfIdsWithDuels.has(m.participantB.id),
  }))

  return {
    competitionId,
    eighthFinals: mapped.filter((m) => m.round === "EIGHTH_FINAL"),
    quarterFinals: mapped.filter((m) => m.round === "QUARTER_FINAL"),
    semiFinals: mapped.filter((m) => m.round === "SEMI_FINAL"),
    final: mapped.find((m) => m.round === "FINAL") ?? null,
  }
}

export async function hasPlayoffsStarted(competitionId: string): Promise<boolean> {
  const count = await db.playoffMatch.count({ where: { competitionId } })
  return count > 0
}
