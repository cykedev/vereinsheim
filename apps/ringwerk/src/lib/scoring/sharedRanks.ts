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
