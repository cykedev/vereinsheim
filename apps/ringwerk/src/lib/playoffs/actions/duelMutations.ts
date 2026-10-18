import type { Prisma } from "@/generated/prisma/client"
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

/**
 * WHERE-Filter für die ganze Folge-Runde. Sie entsteht aus allen Siegern der Runde neu nach Rang
 * (`createNextRoundMatchups`); ein anderer Sieger kann jede ihrer Paarungen ändern, nicht nur die eigene.
 */
function nextRoundFilter(match: MatchScope) {
  return { competitionId: match.competitionId, round: getNextRound(match.round)! }
}

/**
 * Prüft, ob in der Folge-Runde schon ein Duell angelegt ist. Liefert true, wenn eine Korrektur oder Löschung deshalb
 * gesperrt ist. Nur für Nicht-Finale-Runden aufrufen.
 */
export async function hasNextRoundDuels(match: MatchScope): Promise<boolean> {
  const nextMatchWithDuels = await db.playoffMatch.findFirst({
    where: { ...nextRoundFilter(match), duels: { some: {} } },
  })
  return nextMatchWithDuels !== null
}

/** Sieger eines Matches, oder null, solange es nicht abgeschlossen ist. */
export function matchWinner(
  match: Pick<MatchScope, "participantAId" | "participantBId">,
  winsA: number,
  winsB: number,
  complete: boolean
): string | null {
  if (!complete) return null
  return winsA > winsB ? match.participantAId : match.participantBId
}

/**
 * Entfernt die ganze Folge-Runde, nachdem sich der Ausgang eines Matches geändert hat; sie wird danach über „… anlegen“
 * neu gesetzt. Matches mit Duellen bleiben (die Sperre `hasNextRoundDuels` verhindert, dass es sie gibt). In einer
 * Transaktion mit deren Client aufrufen.
 */
export async function deleteNextRound(
  match: MatchScope,
  client: Pick<Prisma.TransactionClient, "playoffMatch"> = db
): Promise<void> {
  if (match.round === "FINAL") return
  await client.playoffMatch.deleteMany({
    where: { ...nextRoundFilter(match), duels: { none: {} } },
  })
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
