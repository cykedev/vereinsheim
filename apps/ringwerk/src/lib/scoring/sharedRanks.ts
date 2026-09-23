/**
 * Wettkampf-Rangfolge „1, 1, 3" über eine bereits sortierte Liste: benachbarte Zeilen, die sich in
 * allen Wertungskriterien gleichen (und nur noch alphabetisch geordnet sind), teilen sich den Platz;
 * der nächste Platz zählt die geteilten mit. Gleichstände liegen nach dem Sortieren nebeneinander,
 * deshalb genügt der Vergleich mit dem Vorgänger.
 */
export function assignSharedRanks<T>(
  sorted: readonly T[],
  isTied: (a: T, b: T) => boolean
): number[] {
  const ranks: number[] = []
  sorted.forEach((row, i) => {
    ranks.push(i > 0 && isTied(sorted[i - 1], row) ? ranks[i - 1] : i + 1)
  })
  return ranks
}

/**
 * Wertungszahlen gelten unterhalb dieser Differenz als gleich: korrigierte Teiler (Teiler × Faktor)
 * und Summen von Nachkommaresten sind Fließkommawerte (8,2 × 1,5 = 12.299999999999999 ≠ 12,3).
 */
export const SCORE_EPSILON = 1e-9

/** Gleichheit zweier (ggf. fehlender) Wertungszahlen — fehlt beiden der Wert, sind sie gleich. */
export function sameScore(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < SCORE_EPSILON
}
