/**
 * Formats a participant's display name.
 * Guests show first name only; regular participants use "Nachname, Vorname".
 */
export function formatParticipantName(participant: {
  firstName: string
  lastName: string
  isGuestRecord: boolean
}): string {
  if (participant.isGuestRecord) return participant.firstName
  return `${participant.lastName}, ${participant.firstName}`
}
