import type { CompetitionStatus } from "@/generated/prisma/client"

/** Ob ein Wettbewerb „Bearbeiten“ anbietet: in jedem Status außer archiviert (Übersicht und Seiten des Wettbewerbs). */
export function offersEdit(status: CompetitionStatus): boolean {
  return status !== "ARCHIVED"
}
