/**
 * Die Id des Anhangs, den die Bestätigung löscht: der gewählte, solange er noch an der Einheit hängt. Ohne Wahl oder
 * wenn er inzwischen weg ist (neu geladen), wird nichts gelöscht.
 */
export function attachmentToDelete(
  chosen: { id: string } | null,
  attachments: readonly { id: string }[]
): string | null {
  if (!chosen) return null
  return attachments.some((attachment) => attachment.id === chosen.id) ? chosen.id : null
}
