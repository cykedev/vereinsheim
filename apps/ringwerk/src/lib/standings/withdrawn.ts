/**
 * Paarung mit mindestens einem zurückgezogenen Teilnehmer: Sie wird nicht gewertet und zählt nicht
 * als offen. Tabellen (Doppelrunde, Best-of, direkter Vergleich) und Playoff-Start nutzen dieses
 * eine Prädikat.
 */
export function involvesWithdrawn(
  matchup: { homeParticipantId: string; awayParticipantId: string | null },
  withdrawnIds: Set<string>
): boolean {
  return (
    withdrawnIds.has(matchup.homeParticipantId) ||
    (matchup.awayParticipantId !== null && withdrawnIds.has(matchup.awayParticipantId))
  )
}
