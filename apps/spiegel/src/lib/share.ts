// Link zum Teilen einer Scheibe: Adresse und Prüfung der Kennung, isomorph (Seite, Abschnitt „Teilen“, Tests)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** eine Kennung aus der Adresse: UUID in Kleinbuchstaben, wie Postgres und `randomUUID` sie schreiben */
export const isShareId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value)

/** die Adresse einer geteilten Scheibe */
export const sharePath = (shareId: string) => `/share/${shareId}`
