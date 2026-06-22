import { db } from "@/lib/db"
import type { MatchStatus } from "@/generated/prisma/client"

/** Werte einer Seite (Heim/Gast) für eine Duell- bzw. Stechschuss-Serie. */
export interface SeriesSide {
  participantId: string
  disciplineId: string
  rings: number
  teiler: number
  ringteiler: number
}

interface PersistSeriesPairArgs {
  matchupId: string
  duelNumber: number
  shotCount: number
  sessionDate: Date
  isTiebreak: boolean
  recordedByUserId: string
  newStatus: MatchStatus
  home: SeriesSide
  away: SeriesSide
  /** Beim Stechschuss werden im Update nur rings/ringteiler aktualisiert. */
  minimalUpdate: boolean
}

/**
 * Upsertet beide Serien (Heim + Gast) für eine Duell- oder Stechschuss-Runde und
 * aktualisiert den Matchup-Status — alles in einer Transaktion.
 *
 * Diese Hilfsfunktion bündelt die zuvor in saveBestOfDuel und saveStechschuss
 * doppelt vorhandene Upsert-Logik (rein strukturell, gleiches Verhalten).
 */
export async function persistSeriesPair(args: PersistSeriesPairArgs): Promise<void> {
  const { matchupId, duelNumber, shotCount, sessionDate, isTiebreak, recordedByUserId } = args
  const { newStatus, home, away, minimalUpdate } = args

  const updateData = (side: SeriesSide) =>
    minimalUpdate
      ? {
          rings: side.rings,
          ringteiler: side.ringteiler,
          recordedByUserId,
        }
      : {
          disciplineId: side.disciplineId,
          shotCount,
          sessionDate,
          rings: side.rings,
          teiler: side.teiler,
          ringteiler: side.ringteiler,
          recordedByUserId,
        }

  const upsertSide = (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], side: SeriesSide) =>
    tx.series.upsert({
      where: {
        matchupId_participantId_duelNumber: {
          matchupId,
          participantId: side.participantId,
          duelNumber,
        },
      },
      create: {
        matchupId,
        participantId: side.participantId,
        disciplineId: side.disciplineId,
        shotCount,
        sessionDate,
        rings: side.rings,
        teiler: side.teiler,
        ringteiler: side.ringteiler,
        importSource: "MANUAL",
        recordedByUserId,
        duelNumber,
        isTiebreak,
      },
      update: updateData(side),
    })

  await db.$transaction(async (tx) => {
    await upsertSide(tx, home)
    await upsertSide(tx, away)
    await tx.matchup.update({
      where: { id: matchupId },
      data: { status: newStatus },
    })
  })
}
