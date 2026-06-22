import { ROUND_LABELS } from "./roundLabels"

type DetailRow = { label: string; value: string }

export function formatAuditDetails(eventType: string, details: unknown): DetailRow[] {
  if (!details || typeof details !== "object") return []
  const d = details as Record<string, unknown>
  const rows: DetailRow[] = []

  const str = (v: unknown) => (v == null ? "–" : String(v))
  const rings = (v: unknown) => (v == null ? "–" : `${v} Ringe`)
  const teiler = (v: unknown) => (v == null ? "–" : String(v))

  switch (eventType) {
    case "PARTICIPANT_WITHDRAWN":
      rows.push({ label: "Name", value: str(d.name) })
      if (d.reason) rows.push({ label: "Grund", value: str(d.reason) })
      break

    case "WITHDRAWAL_REVOKED":
      rows.push({ label: "Name", value: str(d.name) })
      break

    case "RESULT_ENTERED":
    case "RESULT_CORRECTED":
      if (d.homeName) rows.push({ label: "Heim", value: str(d.homeName) })
      rows.push({ label: "Heim – Ringe", value: rings(d.homeRings) })
      rows.push({ label: "Heim – Teiler", value: teiler(d.homeTeiler) })
      if (d.awayName) rows.push({ label: "Gast", value: str(d.awayName) })
      rows.push({ label: "Gast – Ringe", value: rings(d.awayRings) })
      rows.push({ label: "Gast – Teiler", value: teiler(d.awayTeiler) })
      break

    case "PLAYOFF_RESULT_ENTERED":
    case "PLAYOFF_RESULT_CORRECTED":
      rows.push({ label: "Runde", value: ROUND_LABELS[str(d.round)] ?? str(d.round) })
      rows.push({ label: "Duell Nr.", value: str(d.duelNumber) })
      if (d.nameA) rows.push({ label: "Schütze A", value: str(d.nameA) })
      rows.push({ label: "Schütze A – Ringe", value: rings(d.totalRingsA) })
      if (d.teilerA != null) rows.push({ label: "Schütze A – Teiler", value: teiler(d.teilerA) })
      if (d.nameB) rows.push({ label: "Schütze B", value: str(d.nameB) })
      rows.push({ label: "Schütze B – Ringe", value: rings(d.totalRingsB) })
      if (d.teilerB != null) rows.push({ label: "Schütze B – Teiler", value: teiler(d.teilerB) })
      break

    case "PLAYOFF_DUEL_DELETED":
      rows.push({ label: "Runde", value: ROUND_LABELS[str(d.round)] ?? str(d.round) })
      rows.push({ label: "Duell Nr.", value: str(d.duelNumber) })
      if (d.wasCompleted) {
        if (d.nameA) rows.push({ label: "Schütze A", value: str(d.nameA) })
        rows.push({ label: "Schütze A – Ringe", value: rings(d.totalRingsA) })
        if (d.teilerA != null) rows.push({ label: "Schütze A – Teiler", value: teiler(d.teilerA) })
        if (d.nameB) rows.push({ label: "Schütze B", value: str(d.nameB) })
        rows.push({ label: "Schütze B – Ringe", value: rings(d.totalRingsB) })
        if (d.teilerB != null) rows.push({ label: "Schütze B – Teiler", value: teiler(d.teilerB) })
      }
      break

    case "PLAYOFFS_STARTED":
      rows.push({ label: "Teilnehmer", value: str(d.participantCount) })
      break

    case "EVENT_SERIES_ENTERED":
    case "EVENT_SERIES_CORRECTED":
      rows.push({ label: "Schütze", value: str(d.participantName) })
      rows.push({ label: "Ringe", value: rings(d.rings) })
      rows.push({ label: "Teiler", value: teiler(d.teiler) })
      if (d.disciplineName) rows.push({ label: "Disziplin", value: str(d.disciplineName) })
      break

    case "EVENT_SERIES_DELETED":
      rows.push({ label: "Schütze", value: str(d.participantName) })
      rows.push({ label: "Ringe", value: rings(d.rings) })
      rows.push({ label: "Teiler", value: teiler(d.teiler) })
      break

    case "SEASON_SERIES_ENTERED":
    case "SEASON_SERIES_CORRECTED":
      rows.push({ label: "Schütze", value: str(d.participantName) })
      rows.push({ label: "Datum", value: str(d.sessionDate) })
      rows.push({ label: "Ringe", value: rings(d.rings) })
      rows.push({ label: "Teiler", value: teiler(d.teiler) })
      if (d.disciplineName) rows.push({ label: "Disziplin", value: str(d.disciplineName) })
      break

    case "SEASON_SERIES_DELETED":
      rows.push({ label: "Schütze", value: str(d.participantName) })
      rows.push({ label: "Datum", value: str(d.sessionDate) })
      rows.push({ label: "Ringe", value: rings(d.rings) })
      rows.push({ label: "Teiler", value: teiler(d.teiler) })
      break

    case "USER_CREATED":
    case "USER_UPDATED":
      if (d.fullName) rows.push({ label: "Name", value: str(d.fullName) })
      rows.push({ label: "E-Mail", value: str(d.email) })
      rows.push({ label: "Rolle", value: str(d.role) })
      break

    case "USER_DEACTIVATED":
    case "USER_REACTIVATED":
      if (d.fullName) rows.push({ label: "Name", value: str(d.fullName) })
      rows.push({ label: "E-Mail", value: str(d.email) })
      break

    case "PARTICIPANT_CREATED":
    case "PARTICIPANT_UPDATED":
    case "PARTICIPANT_DEACTIVATED":
    case "PARTICIPANT_REACTIVATED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      break

    case "PARTICIPANT_DELETED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      break

    case "PARTICIPANT_FORCE_DELETED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      rows.push({ label: "Wettbewerbe", value: str(d.competitions) })
      break

    case "DISCIPLINE_CREATED":
    case "DISCIPLINE_UPDATED":
      rows.push({ label: "Name", value: str(d.name) })
      rows.push({ label: "Wertungsart", value: str(d.scoringType) })
      if (d.teilerFaktor != null) rows.push({ label: "Teiler-Faktor", value: str(d.teilerFaktor) })
      break

    case "DISCIPLINE_ARCHIVED":
    case "DISCIPLINE_DELETED":
      rows.push({ label: "Name", value: str(d.name) })
      break

    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
      rows.push({ label: "Name", value: str(d.name) })
      rows.push({ label: "Typ", value: str(d.type) })
      rows.push({ label: "Wertungsmodus", value: str(d.scoringMode) })
      break

    case "COMPETITION_STATUS_CHANGED":
      rows.push({ label: "Wettbewerb", value: str(d.name) })
      rows.push({ label: "Von", value: str(d.from) })
      rows.push({ label: "Nach", value: str(d.to) })
      break
  }

  return rows
}
