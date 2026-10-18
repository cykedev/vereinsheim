import type { Prisma, ScoringMode } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getNextRound, isPlayoffMatchComplete, requiredWinsFromBestOf } from "../calculatePlayoffs"
import type { PlayoffRound } from "../types"
import { storedDuelOutcome } from "./duelOutcome"

type Tx = Prisma.TransactionClient

/** Das Match, um das es geht, mit seinen Teilnehmern. */
export interface MatchScope {
  id: string
  round: PlayoffRound
  competitionId: string
  participantAId: string
  participantBId: string
}

/** Regeln aus dem Wettbewerb, nach denen Duelle zählen. */
export interface MatchRules {
  playoffBestOf: number | null
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
  finaleHasSuddenDeath: boolean | null
}

/** Eine Meldung für den User; die Transaktion wird zurückgerollt, nichts ist gespeichert. */
export class PlayoffActionError extends Error {}

const NEXT_ROUND_LOCKED = "nicht möglich — in der nächsten Runde wurden bereits Duelle angelegt."

/**
 * WHERE-Filter für die ganze Folge-Runde. Sie entsteht aus allen Siegern der Runde neu nach Rang
 * (`createNextRoundMatchups`); ein anderer Sieger kann jede ihrer Paarungen ändern, nicht nur die eigene.
 */
function nextRoundFilter(match: Pick<MatchScope, "competitionId" | "round">) {
  return { competitionId: match.competitionId, round: getNextRound(match.round)! }
}

/** Ob in der Folge-Runde schon ein Duell angelegt ist; nur für Nicht-Finale-Runden. */
export async function hasNextRoundDuels(
  match: Pick<MatchScope, "competitionId" | "round">,
  client: Pick<Tx, "playoffMatch">
): Promise<boolean> {
  const nextMatchWithDuels = await client.playoffMatch.findFirst({
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
 * neu gesetzt. Matches mit Duellen bleiben (die Sperre `hasNextRoundDuels` in derselben Transaktion verhindert, dass es
 * sie gibt).
 */
export async function deleteNextRound(
  match: Pick<MatchScope, "competitionId" | "round">,
  client: Pick<Tx, "playoffMatch">
): Promise<void> {
  if (match.round === "FINAL") return
  await client.playoffMatch.deleteMany({
    where: { ...nextRoundFilter(match), duels: { none: {} } },
  })
}

/** Siege aus den fertigen Duellen, gezählt mit derselben Wertung wie beim Eintragen (`storedDuelOutcome`). */
async function countWins(tx: Tx, match: MatchScope, rules: MatchRules) {
  const duels = await tx.playoffDuel.findMany({
    where: { playoffMatchId: match.id, isCompleted: true },
    select: {
      results: {
        select: { participantId: true, totalRings: true, teiler: true, ringteiler: true },
      },
    },
  })
  let winsA = 0
  let winsB = 0
  for (const duel of duels) {
    const a = duel.results.find((r) => r.participantId === match.participantAId)
    const b = duel.results.find((r) => r.participantId === match.participantBId)
    if (!a || !b) continue
    const outcome = storedDuelOutcome(
      a,
      b,
      match.round === "FINAL",
      rules.finalePrimary,
      rules.finaleTiebreaker1,
      rules.finaleTiebreaker2
    )
    if (outcome === "A") winsA++
    else if (outcome === "B") winsB++
  }
  return { winsA, winsB }
}

async function addDuel(tx: Tx, matchId: string, isSuddenDeath: boolean) {
  const last = await tx.playoffDuel.aggregate({
    where: { playoffMatchId: matchId },
    _max: { duelNumber: true },
  })
  await tx.playoffDuel.create({
    data: { playoffMatchId: matchId, duelNumber: (last._max.duelNumber ?? 0) + 1, isSuddenDeath },
  })
}

interface Settle {
  /** Siegstand und Status vor der Änderung, in derselben Transaktion gelesen */
  before: { winsA: number; winsB: number; status: string }
  /** eine Korrektur oder Löschung: ändert sich der Ausgang, fällt die Folge-Runde weg */
  mayChangeOutcome: boolean
  /** ein neu eingetragenes Unentschieden: außerhalb des Finales folgt das nächste Duell */
  newDraw: boolean
  /** nach dem Speichern eines Duells: ein offenes Finale ohne offenes Duell bekommt die Verlängerung */
  finalNeedsDuel: boolean
}

/**
 * Bringt ein Match nach einer Änderung an seinen Duellen in Ordnung: Siege aus den Duellen zählen, Status setzen, offene
 * Duelle eines entschiedenen Matches entfernen, das nächste Duell anlegen und bei geändertem Ausgang die Folge-Runde
 * entfernen. Läuft in der Transaktion der Änderung.
 */
async function settle(tx: Tx, match: MatchScope, rules: MatchRules, opts: Settle) {
  const isFinal = match.round === "FINAL"
  const requiredWins = requiredWinsFromBestOf(rules.playoffBestOf)
  const { winsA, winsB } = await countWins(tx, match, rules)
  const enough = isFinal ? 1 : requiredWins
  if (winsA >= enough && winsB >= enough) {
    throw new PlayoffActionError(
      "Korrektur nicht möglich — danach hätten beide Seiten genug Siege."
    )
  }
  const complete = isPlayoffMatchComplete(winsA, winsB, match.round, requiredWins)
  await tx.playoffMatch.update({
    where: { id: match.id },
    data: { winsA, winsB, status: complete ? "COMPLETED" : "PENDING" },
  })

  if (complete) {
    // ein entschiedenes Match hat keine offenen Duelle mehr
    await tx.playoffDuel.deleteMany({ where: { playoffMatchId: match.id, isCompleted: false } })
  } else {
    const open = await tx.playoffDuel.findMany({
      where: { playoffMatchId: match.id, isCompleted: false },
      select: { id: true },
    })
    if (open.length === 0) {
      if (isFinal && opts.finalNeedsDuel && (rules.finaleHasSuddenDeath ?? true)) {
        // Gleichstand im Finale: In der Oberfläche lässt sich hier kein Duell mehr anlegen, die Verlängerung folgt
        await addDuel(tx, match.id, true)
      } else if (!isFinal && opts.newDraw) {
        await addDuel(tx, match.id, false)
      }
    }
  }

  const before = opts.before
  const winnerBefore = matchWinner(match, before.winsA, before.winsB, before.status === "COMPLETED")
  if (
    !isFinal &&
    opts.mayChangeOutcome &&
    winnerBefore !== matchWinner(match, winsA, winsB, complete)
  ) {
    await deleteNextRound(match, tx)
  }
}

/** Eine Seite (Teilnehmer) eines Duell-Ergebnisses. */
export interface DuelResultSide {
  participantId: string
  totalRings: number
  /** null bei Finale ohne Teiler-Bedarf. */
  teiler: number | null
  ringteiler: number | null
}

/** Protokolleintrag zu einer Änderung; geschrieben in derselben Transaktion */
type Audit = (isCorrection: boolean) => Prisma.AuditLogUncheckedCreateInput

const SERIALIZABLE = { isolationLevel: "Serializable" } as const

/**
 * Speichert das Ergebnis eines Duells (neu oder als Korrektur) und bringt das Match in Ordnung (`settle`), alles in
 * einer serialisierbaren Transaktion. Was davon abhängt, ob es eine Korrektur ist und wie das Match steht, liest sie
 * selbst: Zwei Personen, die zugleich Duelle desselben Matches speichern, ergeben den Stand aus beiden Duellen, oder
 * eine von beiden bekommt die Meldung, dass gleichzeitig geändert wurde.
 */
export async function recordDuelResult(args: {
  duelId: string
  match: MatchScope
  rules: MatchRules
  recordedByUserId: string
  outcome: "A" | "B" | "DRAW"
  a: DuelResultSide
  b: DuelResultSide
  audit: Audit
}): Promise<void> {
  const { duelId, match, rules, recordedByUserId, outcome, a, b, audit } = args
  const isFinal = match.round === "FINAL"
  await db.$transaction(async (tx) => {
    const duel = await tx.playoffDuel.findUniqueOrThrow({
      where: { id: duelId },
      select: { isCompleted: true },
    })
    const before = await tx.playoffMatch.findUniqueOrThrow({
      where: { id: match.id },
      select: { winsA: true, winsB: true, status: true },
    })
    const isCorrection = duel.isCompleted
    if (!isCorrection && before.status === "COMPLETED") {
      throw new PlayoffActionError(
        "Das Match ist schon entschieden, ein weiteres Duell zählt nicht."
      )
    }
    if (isCorrection && !isFinal && (await hasNextRoundDuels(match, tx))) {
      throw new PlayoffActionError(`Korrektur ${NEXT_ROUND_LOCKED}`)
    }

    for (const side of [a, b]) {
      const values = {
        totalRings: side.totalRings,
        teiler: side.teiler,
        ringteiler: side.ringteiler,
        recordedByUserId,
      }
      await tx.playoffDuelResult.upsert({
        where: { duelId_participantId: { duelId, participantId: side.participantId } },
        create: { duelId, participantId: side.participantId, importSource: "MANUAL", ...values },
        update: values,
      })
    }
    await tx.playoffDuel.update({ where: { id: duelId }, data: { isCompleted: true } })

    await settle(tx, match, rules, {
      before,
      mayChangeOutcome: isCorrection,
      newDraw: !isCorrection && outcome === "DRAW",
      finalNeedsDuel: true,
    })
    await tx.auditLog.create({ data: audit(isCorrection) })
  }, SERIALIZABLE)
}

/**
 * Löscht das letzte Duell eines Matches samt Ergebnissen und bringt das Match in Ordnung (`settle`), in einer
 * serialisierbaren Transaktion. Nur das letzte Duell, und nur solange die Folge-Runde kein Duell hat.
 */
export async function removeLastDuel(args: {
  duelId: string
  match: MatchScope
  rules: MatchRules
  audit: Audit
}): Promise<void> {
  const { duelId, match, rules, audit } = args
  await db.$transaction(async (tx) => {
    const duel = await tx.playoffDuel.findUniqueOrThrow({
      where: { id: duelId },
      select: { duelNumber: true },
    })
    const last = await tx.playoffDuel.aggregate({
      where: { playoffMatchId: match.id },
      _max: { duelNumber: true },
    })
    if (duel.duelNumber !== last._max.duelNumber) {
      throw new PlayoffActionError("Nur das letzte Duell kann gelöscht werden.")
    }
    if (match.round !== "FINAL" && (await hasNextRoundDuels(match, tx))) {
      throw new PlayoffActionError(`Löschen ${NEXT_ROUND_LOCKED}`)
    }
    const before = await tx.playoffMatch.findUniqueOrThrow({
      where: { id: match.id },
      select: { winsA: true, winsB: true, status: true },
    })
    await tx.playoffDuelResult.deleteMany({ where: { duelId } })
    await tx.playoffDuel.delete({ where: { id: duelId } })
    await settle(tx, match, rules, {
      before,
      mayChangeOutcome: true,
      newDraw: false,
      finalNeedsDuel: false,
    })
    await tx.auditLog.create({ data: audit(true) })
  }, SERIALIZABLE)
}

/**
 * Meldung für den User zu einem Fehler aus `recordDuelResult` oder `removeLastDuel`: die eigene Meldung, bei einer
 * gleichzeitigen Änderung (Prisma `P2034`, Postgres „could not serialize“) die Bitte, neu zu laden, sonst `fallback`.
 */
export function playoffFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof PlayoffActionError) return error.message
  const code = (error as { code?: unknown } | null)?.code
  const text = error instanceof Error ? error.message : String(error)
  if (code === "P2034" || /could not serialize/i.test(text)) {
    return "Das Match wurde gleichzeitig geändert. Bitte die Seite neu laden und noch einmal speichern."
  }
  console.error("Fehler bei einem Playoff-Duell:", text)
  return fallback
}
