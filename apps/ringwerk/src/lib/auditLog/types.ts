export type AuditEventType =
  | "PARTICIPANT_WITHDRAWN"
  | "WITHDRAWAL_REVOKED"
  | "RESULT_ENTERED"
  | "RESULT_CORRECTED"
  | "PLAYOFF_RESULT_ENTERED"
  | "PLAYOFF_RESULT_CORRECTED"
  | "PLAYOFF_DUEL_DELETED"
  | "PLAYOFFS_STARTED"
  | "EVENT_SERIES_ENTERED"
  | "EVENT_SERIES_CORRECTED"
  | "EVENT_SERIES_DELETED"
  | "SEASON_SERIES_ENTERED"
  | "SEASON_SERIES_CORRECTED"
  | "SEASON_SERIES_DELETED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "PARTICIPANT_CREATED"
  | "PARTICIPANT_UPDATED"
  | "PARTICIPANT_DEACTIVATED"
  | "PARTICIPANT_REACTIVATED"
  | "PARTICIPANT_DELETED"
  | "PARTICIPANT_FORCE_DELETED"
  | "DISCIPLINE_CREATED"
  | "DISCIPLINE_UPDATED"
  | "DISCIPLINE_ARCHIVED"
  | "DISCIPLINE_DELETED"
  | "COMPETITION_CREATED"
  | "COMPETITION_UPDATED"
  | "COMPETITION_STATUS_CHANGED"

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  PARTICIPANT_WITHDRAWN: "Teilnehmer zurückgezogen",
  WITHDRAWAL_REVOKED: "Rückzug widerrufen",
  RESULT_ENTERED: "Ergebnis erfasst",
  RESULT_CORRECTED: "Ergebnis korrigiert",
  PLAYOFF_RESULT_ENTERED: "Playoff-Ergebnis erfasst",
  PLAYOFF_RESULT_CORRECTED: "Playoff-Ergebnis korrigiert",
  PLAYOFF_DUEL_DELETED: "Playoff-Duell gelöscht",
  PLAYOFFS_STARTED: "Playoffs gestartet",
  EVENT_SERIES_ENTERED: "Serie erfasst",
  EVENT_SERIES_CORRECTED: "Serie korrigiert",
  EVENT_SERIES_DELETED: "Serie gelöscht",
  SEASON_SERIES_ENTERED: "Saison-Serie erfasst",
  SEASON_SERIES_CORRECTED: "Saison-Serie korrigiert",
  SEASON_SERIES_DELETED: "Saison-Serie gelöscht",
  USER_CREATED: "Nutzer angelegt",
  USER_UPDATED: "Nutzer bearbeitet",
  USER_DEACTIVATED: "Nutzer deaktiviert",
  USER_REACTIVATED: "Nutzer reaktiviert",
  PARTICIPANT_CREATED: "Teilnehmer angelegt",
  PARTICIPANT_UPDATED: "Teilnehmer bearbeitet",
  PARTICIPANT_DEACTIVATED: "Teilnehmer deaktiviert",
  PARTICIPANT_REACTIVATED: "Teilnehmer reaktiviert",
  PARTICIPANT_DELETED: "Teilnehmer gelöscht",
  PARTICIPANT_FORCE_DELETED: "Teilnehmer endgültig gelöscht",
  DISCIPLINE_CREATED: "Disziplin angelegt",
  DISCIPLINE_UPDATED: "Disziplin bearbeitet",
  DISCIPLINE_ARCHIVED: "Disziplin archiviert",
  DISCIPLINE_DELETED: "Disziplin gelöscht",
  COMPETITION_CREATED: "Wettbewerb angelegt",
  COMPETITION_UPDATED: "Wettbewerb bearbeitet",
  COMPETITION_STATUS_CHANGED: "Wettbewerb-Status geändert",
}

export type AuditEventCategory = "participant" | "result" | "playoff" | "destructive" | "admin"

export const AUDIT_EVENT_CATEGORY: Record<string, AuditEventCategory> = {
  PARTICIPANT_WITHDRAWN: "participant",
  WITHDRAWAL_REVOKED: "participant",
  RESULT_ENTERED: "result",
  RESULT_CORRECTED: "result",
  PLAYOFF_RESULT_ENTERED: "playoff",
  PLAYOFF_RESULT_CORRECTED: "playoff",
  PLAYOFF_DUEL_DELETED: "destructive",
  PLAYOFFS_STARTED: "playoff",
  EVENT_SERIES_ENTERED: "result",
  EVENT_SERIES_CORRECTED: "result",
  EVENT_SERIES_DELETED: "destructive",
  SEASON_SERIES_ENTERED: "result",
  SEASON_SERIES_CORRECTED: "result",
  SEASON_SERIES_DELETED: "destructive",
  USER_CREATED: "admin",
  USER_UPDATED: "admin",
  USER_DEACTIVATED: "admin",
  USER_REACTIVATED: "admin",
  PARTICIPANT_CREATED: "admin",
  PARTICIPANT_UPDATED: "admin",
  PARTICIPANT_DEACTIVATED: "admin",
  PARTICIPANT_REACTIVATED: "admin",
  PARTICIPANT_DELETED: "destructive",
  PARTICIPANT_FORCE_DELETED: "destructive",
  DISCIPLINE_CREATED: "admin",
  DISCIPLINE_UPDATED: "admin",
  DISCIPLINE_ARCHIVED: "admin",
  DISCIPLINE_DELETED: "admin",
  COMPETITION_CREATED: "admin",
  COMPETITION_UPDATED: "admin",
  COMPETITION_STATUS_CHANGED: "admin",
}

// Detail-Formatierung liegt in ./formatDetails und ./description; hier
// re-exportiert, damit der öffentliche Import-Pfad "@/lib/auditLog/types" stabil bleibt.
export { formatAuditDetails } from "./formatDetails"
export { getAuditDescription } from "./description"
