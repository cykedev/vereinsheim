// Woher die Übernahme ein Konto aus Treffsicher liest (ADR-002: Spiegel verbindet sich nie mit der Datenbank von
// Treffsicher). In Dev über `psql` im Container (`tools/transfer/source-dev.ts`), im Container des Betriebs aus der Pipe
// (`tools/transfer/source-export.ts`), in Tests aus dem Speicher.

export interface TreffsicherSource {
  /** das Konto mit allen Einheiten, Zielen und Abläufen als JSON (`treffsicherAccount`); null ohne Treffer */
  readAccount(email: string): Promise<unknown | null>
  /** je Kennung einer Einheit, eines Ziels oder Ablaufs das Konto in Treffsicher; unbekannte fehlen */
  sessionOwners(ids: readonly string[]): Promise<Map<string, string>>
  /**
   * das Konto als umgezogen markieren (`User.movedToSpiegelAt`, Treffsicher zeigt es dann nur lesend); null nimmt das
   * Merkmal zurück (der erste Lauf, dessen Speichern scheiterte). Fehlt es, setzt der Aufrufer das Merkmal nach dem
   * Commit (`vereinsheim transfer` auf dem Host, `marked: "caller"`).
   */
  markMoved?(userId: string, at: Date | null): Promise<void>
}
