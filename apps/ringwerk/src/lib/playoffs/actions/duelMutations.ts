import { db } from "@/lib/db"
import { getNextRound } from "../calculatePlayoffs"
import type { PlayoffRound } from "../types"

/** Gemeinsamer Match-Kontext für Kaskaden-Operationen auf Folge-Runden. */
interface MatchScope {
  round: PlayoffRound
  competitionId: string
  participantAId: string
  participantBId: string
}

/** WHERE-Filter für Folge-Runden-Matches derselben beiden Teilnehmer. */
function nextRoundParticipantsFilter(nextRound: PlayoffRound, match: MatchScope) {
  return {
    competitionId: match.competitionId,
    round: nextRound,
    OR: [
      { participantAId: match.participantAId },
      { participantAId: match.participantBId },
      { participantBId: match.participantAId },
      { participantBId: match.participantBId },
    ],
  }
}

/**
 * Prüft, ob in der direkten Folge-Runde derselben Teilnehmer bereits ein Match
 * mit gespielten Duellen existiert. Liefert true, wenn eine Korrektur/Löschung
 * deshalb gesperrt ist. Nur für Nicht-Finale-Runden aufrufen.
 */
export async function hasNextRoundDuels(match: MatchScope): Promise<boolean> {
  const nextRound = getNextRound(match.round)!
  const nextMatchWithDuels = await db.playoffMatch.findFirst({
    where: { ...nextRoundParticipantsFilter(nextRound, match), duels: { some: {} } },
  })
  return nextMatchWithDuels !== null
}

/**
 * Löscht leere Folge-Runden-Matches (ohne Duelle) nach Ergebnis-Revert.
 */
export async function cascadeDeleteEmptyNextRound(match: MatchScope): Promise<void> {
  if (match.round === "FINAL") return
  const nextRound = getNextRound(match.round)!
  const emptyNextMatches = await db.playoffMatch.findMany({
    where: { ...nextRoundParticipantsFilter(nextRound, match), duels: { none: {} } },
    select: { id: true },
  })
  for (const m of emptyNextMatches) {
    await db.playoffMatch.delete({ where: { id: m.id } })
  }
}

/**
 * Legt ein weiteres Duell nach Gleichstand an.
 * isSuddenDeath=true für Finale-Verlängerung, false für VF/HF-Nachschuss.
 */
export async function addExtraDuel(playoffMatchId: string, isSuddenDeath: boolean): Promise<void> {
  const lastDuel = await db.playoffDuel.findFirst({
    where: { playoffMatchId },
    orderBy: { duelNumber: "desc" },
    select: { duelNumber: true },
  })

  await db.playoffDuel.create({
    data: {
      playoffMatchId,
      duelNumber: (lastDuel?.duelNumber ?? 0) + 1,
      isSuddenDeath,
    },
  })
}

/** Eine Seite (Teilnehmer) eines persistierten Playoff-Duell-Ergebnisses. */
interface DuelResultSide {
  participantId: string
  totalRings: number
  /** null bei Finale ohne Teiler-Bedarf. */
  teiler: number | null
  ringteiler: number | null
}

interface PersistDuelResultArgs {
  duelId: string
  matchId: string
  recordedByUserId: string
  newWinsA: number
  newWinsB: number
  matchComplete: boolean
  a: DuelResultSide
  b: DuelResultSide
}

/**
 * Persistiert beide Duell-Ergebnisse, markiert das Duell als abgeschlossen und
 * aktualisiert Siegstand + Match-Status — alles in einer Transaktion.
 * Verhalten identisch zum vorherigen Inline-Transaktionsblock.
 */
export async function persistDuelResult(args: PersistDuelResultArgs): Promise<void> {
  const { duelId, matchId, recordedByUserId, newWinsA, newWinsB, matchComplete, a, b } = args

  const upsertSide = (
    tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
    side: DuelResultSide
  ) =>
    tx.playoffDuelResult.upsert({
      where: { duelId_participantId: { duelId, participantId: side.participantId } },
      create: {
        duelId,
        participantId: side.participantId,
        totalRings: side.totalRings,
        teiler: side.teiler,
        ringteiler: side.ringteiler,
        importSource: "MANUAL",
        recordedByUserId,
      },
      update: {
        totalRings: side.totalRings,
        teiler: side.teiler,
        ringteiler: side.ringteiler,
        recordedByUserId,
      },
    })

  await db.$transaction(async (tx) => {
    // Ergebnisse für beide Teilnehmer upserten
    // Finale ohne Teiler: teiler + ringteiler bleiben null
    await upsertSide(tx, a)
    await upsertSide(tx, b)

    // Duell als abgeschlossen markieren
    await tx.playoffDuel.update({
      where: { id: duelId },
      data: { isCompleted: true },
    })

    // Siege-Stand und Match-Status aktualisieren
    await tx.playoffMatch.update({
      where: { id: matchId },
      data: {
        winsA: newWinsA,
        winsB: newWinsB,
        status: matchComplete ? "COMPLETED" : "PENDING",
      },
    })
  })
}
