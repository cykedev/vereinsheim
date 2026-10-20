"use server"

import { revalidatePath } from "next/cache"
import { isConflict, serializable } from "@/lib/serializable"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { generateSchedule } from "./generateSchedule"
import { generateBestOfSchedule } from "./generateBestOfSchedule"
import { getScheduleResultCounts } from "./queries"
import { scheduleRegenerationBlocker } from "./regeneration"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"
import type { AuditEventType } from "@/lib/auditLog/types"

/**
 * Generiert den Spielplan für einen aktiven Wettkampf.
 * Voraussetzungen:
 * - Wettkampf muss ACTIVE sein
 * - Mindestens 4 aktive Teilnehmer eingeschrieben
 * - Noch kein Ergebnis erfasst (keine entschiedene Paarung, keine Serie, keine Playoffs)
 *
 * Bestehende offene Paarungen (PENDING) und Freilose (BYE) werden gelöscht und neu generiert.
 */
export async function generateCompetitionSchedule(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  // Alles, wovon der Spielplan abhängt, liest die Transaktion selbst: Bricht Postgres sie wegen einer gleichzeitigen
  // Änderung ab (auch einer Einschreibung oder eines Spielplans in einem anderen Wettbewerb), läuft sie mit dem neuen
  // Stand noch einmal (`serializable`).
  //
  // Sperre, Löschen und Anlegen in derselben Transaktion. Neu generieren nur ohne jedes Ergebnis: eine Best-of-Paarung
  // bleibt PENDING, bis alle Duelle entschieden sind, und Series.matchupId steht auf ON DELETE SET NULL — ein Löschen
  // ließe erfasste Serien still verwaisen. `series: { none: {} }` sichert das zusätzlich am Löschbefehl selbst ab; ein
  // parallel gespeichertes Ergebnis führt zum Serialisierungsfehler statt zu Datenverlust.
  let problem: string | null
  try {
    problem = await serializable(async (tx) => {
      const competition = await tx.competition.findUnique({
        where: { id: competitionId },
        select: {
          id: true,
          status: true,
          leagueFormat: true,
          hinrundeDeadline: true,
          rueckrundeDeadline: true,
        },
      })
      if (!competition) return "Liga nicht gefunden."
      if (competition.status !== "ACTIVE") {
        return "Spielplan kann nur für aktive Ligen generiert werden."
      }

      const enrollments = await tx.competitionParticipant.findMany({
        where: { competitionId, status: "ACTIVE" },
        select: { participantId: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
      if (enrollments.length < 4) {
        return `Mindestens 4 aktive Teilnehmer erforderlich (aktuell: ${enrollments.length}).`
      }

      const reason = scheduleRegenerationBlocker(await getScheduleResultCounts(competitionId, tx))
      if (reason) return reason

      const participantIds = enrollments.map((e) => e.participantId)
      const matchupData =
        competition.leagueFormat === "BEST_OF_SINGLE"
          ? generateBestOfSchedule(participantIds).map((m) => ({
              competitionId,
              homeParticipantId: m.homeId,
              awayParticipantId: m.awayId,
              round: "FIRST_LEG" as const,
              roundIndex: m.roundIndex,
              status: m.awayId === null ? ("BYE" as const) : ("PENDING" as const),
              dueDate: competition.hinrundeDeadline,
            }))
          : // DOUBLE_ROUND_ROBIN (default)
            generateSchedule(participantIds).map((m) => ({
              competitionId,
              homeParticipantId: m.homeId,
              awayParticipantId: m.awayId,
              round: m.round,
              roundIndex: m.roundIndex,
              status: m.awayId === null ? ("BYE" as const) : ("PENDING" as const),
              dueDate:
                m.round === "FIRST_LEG"
                  ? competition.hinrundeDeadline
                  : competition.rueckrundeDeadline,
            }))

      // Gibt es schon Paarungen, ersetzt dieser Lauf einen Spielplan (fürs Protokoll)
      const existing = await tx.matchup.count({ where: { competitionId } })

      // Offene Paarungen und Freilose (BYE) gehören zum alten Plan — blieben Freilose stehen,
      // hätte jeder Teilnehmer danach zwei je Runde.
      await tx.matchup.deleteMany({
        where: { competitionId, status: { in: ["PENDING", "BYE"] }, series: { none: {} } },
      })
      await tx.matchup.createMany({ data: matchupData })
      await tx.auditLog.create({
        data: {
          eventType: (existing > 0
            ? "SCHEDULE_REGENERATED"
            : "SCHEDULE_GENERATED") satisfies AuditEventType,
          entityType: "COMPETITION",
          entityId: competitionId,
          userId: session.user.id,
          competitionId,
          details: { matchups: matchupData.filter((m) => m.status !== "BYE").length },
        },
      })
      return null
    })
  } catch (error) {
    if (isConflict(error)) {
      return {
        error:
          "Der Spielplan wurde gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.",
      }
    }
    console.error("Spielplan-Generierung fehlgeschlagen:", error)
    return { error: "Spielplan konnte nicht generiert werden. Bitte erneut versuchen." }
  }
  if (problem) return { error: problem }

  revalidatePath(`/competitions/${competitionId}/schedule`)
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePublicPdf(competitionId)

  return { success: true }
}
