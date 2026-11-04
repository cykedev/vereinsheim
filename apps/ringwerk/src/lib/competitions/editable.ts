import type { CompetitionStatus } from "@/generated/prisma/client"

/**
 * Ob ein Wettbewerb bearbeitet werden kann: in jedem Status außer archiviert. Gilt für den Knopf in Übersicht und
 * Seiten, die Bearbeiten-Seite und das Speichern (`updateCompetition`).
 */
export function offersEdit(status: CompetitionStatus): boolean {
  return status !== "ARCHIVED"
}
