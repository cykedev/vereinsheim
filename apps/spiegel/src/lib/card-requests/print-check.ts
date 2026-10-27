// Schuss für Schuss: Passt eine Scheibe der Brücke zu den Werten eines Ausdrucks? Rein ([[spiegel-assignment]]). Der
// Ausdruck zeigt die ersten Schüsse einer Art (Probe oder Wertung, ein Zwischenausdruck weniger), die Rohdaten müssen
// mit denselben beginnen: Zehntel gleich, wo der Ausdruck sie hat, sonst der Ring.

export interface PrintedShot {
  /** 0 = Probe */
  stellung: number
  treffer: number
  ring: number | null
  decimalTenths: number | null
}

const inOrder = (a: PrintedShot, b: PrintedShot) => a.stellung - b.stellung || a.treffer - b.treffer

/**
 * Beginnen die Schüsse der Rohdaten derselben Art mit den Schüssen des Ausdrucks? Ohne Schüsse am Ausdruck gilt nur die
 * Druckzeit (wahr).
 */
export function printedShotsFit(
  printed: readonly PrintedShot[],
  raw: readonly PrintedShot[]
): boolean {
  if (printed.length === 0) return true
  const probe = printed.every((shot) => shot.stellung === 0)
  const sameKind = (shot: PrintedShot) => (shot.stellung === 0) === probe
  const own = printed.filter(sameKind).sort(inOrder)
  const theirs = raw.filter(sameKind).sort(inOrder)
  if (own.length !== printed.length || theirs.length < own.length) return false
  return own.every((shot, i) => {
    const other = theirs[i]
    if (shot.decimalTenths !== null) return shot.decimalTenths === other.decimalTenths
    return shot.ring !== null && shot.ring === other.ring
  })
}
