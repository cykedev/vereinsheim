"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidateCompetitionPaths } from "./_shared"

/** Löschen nur ohne abhängige Daten (Teilnehmer, Paarungen, Playoffs). */
export async function deleteCompetition(id: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({ where: { id }, select: { id: true } })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  const [participantCount, matchupCount, playoffCount] = await Promise.all([
    db.competitionParticipant.count({ where: { competitionId: id } }),
    db.matchup.count({ where: { competitionId: id } }),
    db.playoffMatch.count({ where: { competitionId: id } }),
  ])

  if (participantCount > 0 || matchupCount > 0 || playoffCount > 0) {
    return {
      error:
        "Wettbewerb kann nicht gelöscht werden — es sind bereits Daten verknüpft. Bitte archivieren.",
    }
  }

  await db.competition.delete({ where: { id } })
  revalidateCompetitionPaths()
  return { success: true }
}

/** Endgültiges Löschen eines Wettbewerbs inkl. aller abhängigen Daten. */
export async function forceDeleteCompetition(
  competitionId: string,
  confirmationName: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  if (confirmationName.trim() !== competition.name) {
    return { error: "Der eingegebene Name stimmt nicht mit dem Wettbewerb-Namen überein." }
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. IDs sammeln für Bottom-up-Löschung
      const matchups = await tx.matchup.findMany({
        where: { competitionId },
        select: { id: true },
      })
      const matchupIds = matchups.map((m) => m.id)

      const playoffMatches = await tx.playoffMatch.findMany({
        where: { competitionId },
        select: { id: true },
      })
      const playoffMatchIds = playoffMatches.map((pm) => pm.id)

      // 2. Playoff-Struktur löschen
      if (playoffMatchIds.length > 0) {
        const playoffDuels = await tx.playoffDuel.findMany({
          where: { playoffMatchId: { in: playoffMatchIds } },
          select: { id: true },
        })
        const playoffDuelIds = playoffDuels.map((pd) => pd.id)

        if (playoffDuelIds.length > 0) {
          await tx.playoffDuelResult.deleteMany({
            where: { duelId: { in: playoffDuelIds } },
          })
          await tx.playoffDuel.deleteMany({
            where: { id: { in: playoffDuelIds } },
          })
        }

        await tx.playoffMatch.deleteMany({
          where: { id: { in: playoffMatchIds } },
        })
      }

      // 3. Liga-Serien (via matchupId)
      if (matchupIds.length > 0) {
        await tx.series.deleteMany({
          where: { matchupId: { in: matchupIds } },
        })
      }

      await tx.matchup.deleteMany({ where: { competitionId } })

      // 4. Event/Saison-Serien (via competitionId)
      await tx.series.deleteMany({ where: { competitionId } })

      // 5. AuditLog + Teilnehmer (CPs halten FK auf EventTeam → zuerst CPs löschen) + Teams + Wettbewerb
      await tx.auditLog.deleteMany({ where: { competitionId } })
      await tx.competitionParticipant.deleteMany({ where: { competitionId } })
      await tx.eventTeam.deleteMany({ where: { competitionId } })
      await tx.competition.delete({ where: { id: competitionId } })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim endgültigen Löschen des Wettbewerbs:", msg)
    return { error: "Wettbewerb konnte nicht gelöscht werden." }
  }

  revalidateCompetitionPaths()
  return { success: true }
}
