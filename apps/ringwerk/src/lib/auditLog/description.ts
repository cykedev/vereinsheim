import { ROUND_LABELS } from "./roundLabels"

export function getAuditDescription(eventType: string, details: unknown): string | null {
  if (!details || typeof details !== "object") return null
  const d = details as Record<string, unknown>
  const s = (v: unknown) => String(v)

  switch (eventType) {
    case "PARTICIPANT_WITHDRAWN":
    case "WITHDRAWAL_REVOKED":
      return d.name ? s(d.name) : null

    case "RESULT_ENTERED":
    case "RESULT_CORRECTED":
      if (d.homeName && d.awayName) {
        const roundLabel = d.round ? `${ROUND_LABELS[s(d.round)] ?? s(d.round)}: ` : ""
        return `${roundLabel}${s(d.homeName)} vs. ${s(d.awayName)}`
      }
      return null

    case "PLAYOFF_RESULT_ENTERED":
    case "PLAYOFF_RESULT_CORRECTED":
    case "PLAYOFF_DUEL_DELETED":
      if (d.nameA && d.nameB) {
        const roundLabel = d.round ? `${ROUND_LABELS[s(d.round)] ?? s(d.round)}: ` : ""
        return `${roundLabel}${s(d.nameA)} vs. ${s(d.nameB)}`
      }
      return null

    case "PLAYOFFS_STARTED":
      return d.participantCount ? `${s(d.participantCount)} Teilnehmer` : null

    case "EVENT_SERIES_ENTERED":
    case "EVENT_SERIES_CORRECTED":
    case "EVENT_SERIES_DELETED":
    case "SEASON_SERIES_ENTERED":
    case "SEASON_SERIES_CORRECTED":
    case "SEASON_SERIES_DELETED":
      return d.participantName ? s(d.participantName) : null

    case "USER_CREATED":
    case "USER_UPDATED":
    case "USER_DEACTIVATED":
    case "USER_REACTIVATED":
      return d.fullName ? s(d.fullName) : d.email ? s(d.email) : null

    case "PARTICIPANT_CREATED":
    case "PARTICIPANT_UPDATED":
    case "PARTICIPANT_DEACTIVATED":
    case "PARTICIPANT_REACTIVATED":
    case "PARTICIPANT_DELETED":
    case "PARTICIPANT_FORCE_DELETED":
      return d.firstName && d.lastName ? `${s(d.firstName)} ${s(d.lastName)}` : null

    case "DISCIPLINE_CREATED":
    case "DISCIPLINE_UPDATED":
    case "DISCIPLINE_ARCHIVED":
    case "DISCIPLINE_DELETED":
      return d.name ? s(d.name) : null

    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
      return d.name ? s(d.name) : null

    case "COMPETITION_STATUS_CHANGED":
      return d.name ? `${s(d.name)}: ${s(d.from)} → ${s(d.to)}` : null

    default:
      return null
  }
}
