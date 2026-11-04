import type { Prisma } from "@/generated/prisma/client"
import type { AuditEventType } from "@/lib/auditLog/types"
import { generateSchedule } from "./generateSchedule"
import { generateBestOfSchedule } from "./generateBestOfSchedule"
import { getScheduleResultCounts } from "./queries"
import { scheduleRegenerationBlocker } from "./regeneration"

/**
 * Erzeugt den Spielplan einer Liga in der Transaktion `tx` neu, im Format, das in dieser Transaktion gespeichert ist.
 * Liefert den Grund, warum es nicht geht, oder `null`. Alle Prüfungen laufen vor dem ersten Schreiben: Ein Grund
 * hinterlässt nichts.
 *
 * Voraussetzungen:
 * - Wettkampf muss ACTIVE sein
 * - Mindestens 4 aktive Teilnehmer eingeschrieben
 * - Noch kein Ergebnis erfasst (keine entschiedene Paarung, keine Serie, keine Playoffs)
 *
 * Sperre, Löschen und Anlegen in derselben Transaktion. Neu generieren nur ohne jedes Ergebnis: eine Best-of-Paarung
 * bleibt PENDING, bis alle Duelle entschieden sind, und Series.matchupId steht auf ON DELETE SET NULL — ein Löschen
 * ließe erfasste Serien still verwaisen. `series: { none: {} }` sichert das zusätzlich am Löschbefehl selbst ab; ein
 * parallel gespeichertes Ergebnis führt zum Serialisierungsfehler statt zu Datenverlust. Alles, wovon der Spielplan
 * abhängt, liest die Funktion selbst in `tx`, damit `serializable` sie nach einem Abbruch wiederholen kann.
 */
export async function replaceSchedule(
  tx: Prisma.TransactionClient,
  competitionId: string,
  userId: string
): Promise<string | null> {
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
            m.round === "FIRST_LEG" ? competition.hinrundeDeadline : competition.rueckrundeDeadline,
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
      userId,
      competitionId,
      details: { matchups: matchupData.filter((m) => m.status !== "BYE").length },
    },
  })
  return null
}
