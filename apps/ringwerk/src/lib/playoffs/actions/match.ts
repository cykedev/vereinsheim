"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { getSeedingStandings } from "@/lib/playoffs/queries"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"
import { createNextRoundMatchups, getNextRound } from "../calculatePlayoffs"
import type { PlayoffRound } from "../types"
import { playoffFailureMessage } from "./duelMutations"

const MATCHES_PER_ROUND: Record<Exclude<PlayoffRound, "FINAL">, number> = {
  EIGHTH_FINAL: 8,
  QUARTER_FINAL: 4,
  SEMI_FINAL: 2,
}

const PREVIOUS_ROUND: Record<
  Exclude<PlayoffRound, "FINAL">,
  Exclude<PlayoffRound, "FINAL"> | null
> = {
  EIGHTH_FINAL: null,
  QUARTER_FINAL: "EIGHTH_FINAL",
  SEMI_FINAL: "QUARTER_FINAL",
}

const ROUND_NAME: Record<Exclude<PlayoffRound, "FINAL">, string> = {
  EIGHTH_FINAL: "Achtelfinale",
  QUARTER_FINAL: "Viertelfinale",
  SEMI_FINAL: "Halbfinale",
}

/**
 * Setzt manuell die nächste Runde an, wenn alle Matches der aktuellen Runde abgeschlossen sind.
 * Nur Admin.
 */
export async function advanceRound(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  // Lesen und Anlegen in einer serialisierbaren Transaktion: Eine Korrektur, die zur selben Zeit die Runde ändert, lässt
  // eine der beiden scheitern, statt die nächste Runde aus alten Siegern zu setzen
  let problem: string | null
  try {
    problem = await db.$transaction(
      async (tx) => {
        const matches = await tx.playoffMatch.findMany({
          where: { competitionId },
          select: {
            id: true,
            round: true,
            status: true,
            winsA: true,
            winsB: true,
            participantAId: true,
            participantBId: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })

        if (matches.length === 0) return "Keine Playoffs gefunden."

        // Höchste Runde ohne Folge-Runde ermitteln
        const hasEF = matches.some((m) => m.round === "EIGHTH_FINAL")
        const hasQF = matches.some((m) => m.round === "QUARTER_FINAL")
        const hasSF = matches.some((m) => m.round === "SEMI_FINAL")
        const hasFinal = matches.some((m) => m.round === "FINAL")

        let roundToAdvance: PlayoffRound | null = null
        if (hasEF && !hasQF) {
          roundToAdvance = "EIGHTH_FINAL"
        } else if (hasQF && !hasSF) {
          roundToAdvance = "QUARTER_FINAL"
        } else if (hasSF && !hasFinal) {
          roundToAdvance = "SEMI_FINAL"
        }

        if (!roundToAdvance) return "Keine Runde zum Anlegen der nächsten Runde."

        const currentRoundMatches = matches.filter((m) => m.round === roundToAdvance)
        if (!currentRoundMatches.every((m) => m.status === "COMPLETED")) {
          return "Noch nicht alle Matches der aktuellen Runde abgeschlossen."
        }

        return handleMatchCompletion(tx, competitionId, roundToAdvance)
      },
      { isolationLevel: "Serializable" }
    )
  } catch (error) {
    return {
      error: playoffFailureMessage(error, "Die nächste Runde konnte nicht angelegt werden."),
    }
  }
  if (problem) return { error: problem }

  revalidatePath(`/competitions/${competitionId}/playoffs`)
  revalidatePublicPdf(competitionId)
  return { success: true }
}

/**
 * Legt die nächste Runde an, wenn alle Matches der Runde abgeschlossen sind (aus `advanceRound`).
 * Bei FINAL → keine weitere Runde.
 * Liefert eine Meldung für den User, wenn der Runde eine Paarung fehlt, sonst null.
 */
async function handleMatchCompletion(
  tx: Prisma.TransactionClient,
  competitionId: string,
  round: PlayoffRound
): Promise<string | null> {
  if (round === "FINAL") return null

  const allMatchesInRound = await tx.playoffMatch.findMany({
    where: { competitionId, round },
    select: {
      id: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
    },
    // in der Reihenfolge, in der die Runde gesetzt wurde: Der Sieger des oberen Halbfinales wird A im Finale
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })

  const allComplete = allMatchesInRound.every((m) => m.status === "COMPLETED")
  if (!allComplete) return null

  // Fehlt der Runde eine Paarung, gibt es keine vollständige nächste Runde; ohne diese Prüfung entstünde etwa ein Finale
  // mit einem Teilnehmer. Die Meldung nennt den Weg, die Runde aus der vorigen neu zu setzen
  if (allMatchesInRound.length !== MATCHES_PER_ROUND[round]) {
    const previous = PREVIOUS_ROUND[round]
    const hasPrevious =
      previous !== null &&
      (await tx.playoffMatch.count({ where: { competitionId, round: previous } })) > 0
    return hasPrevious
      ? `Im ${ROUND_NAME[round]} fehlt eine Paarung, so lässt sich die nächste Runde nicht anlegen. Abhilfe: Im ` +
          `${ROUND_NAME[round]} alle Duelle löschen. Dann im ${ROUND_NAME[previous]} in einem Match das entscheidende ` +
          `(letzte) Duell löschen und neu eintragen. Danach „${ROUND_NAME[round]} anlegen“.`
      : `Im ${ROUND_NAME[round]} fehlt eine Paarung, so lässt sich die nächste Runde nicht anlegen.`
  }

  const winners = allMatchesInRound.map((m) =>
    m.winsA > m.winsB ? m.participantAId : m.participantBId
  )

  const nextRound = getNextRound(round)!

  if (nextRound === "FINAL") {
    await tx.playoffMatch.create({
      data: {
        competitionId,
        round: "FINAL",
        participantAId: winners[0],
        participantBId: winners[1],
      },
    })
    return null
  }

  // Re-Seeding nach Original-Gruppenrang — Gruppentabelle des Liga-Formats (Best-of: Best-of-
  // Tabelle), nach Tabellenposition, nicht nach dem (ggf. geteilten) Platz, sonst wäre die Setzung
  // bei Gleichstand nicht eindeutig.
  const standings = await getSeedingStandings(competitionId)
  const rankMap = new Map(standings.map((s, i) => [s.participantId, i + 1]))
  const nextMatchups = createNextRoundMatchups(winners, rankMap)

  await tx.playoffMatch.createMany({
    data: nextMatchups.map((m) => ({
      competitionId,
      round: nextRound,
      participantAId: m.participantAId,
      participantBId: m.participantBId,
    })),
  })
  return null
}
