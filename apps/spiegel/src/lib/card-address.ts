import type { Scoring } from "@vereinsheim/shot-core/metrics"

/**
 * Der Anker der Adresse, nur wenn die Adresse die eigene ist: Beim Blättern rendert Next die nächste Scheibe, solange die
 * Adresse noch die der vorigen ist; deren Anker („#position“) wäre sonst der Reiter der nächsten (gefunden von der
 * Skriptprüfung der App, 13. Oktober 2026).
 */
export function ownHash(current: { pathname: string; hash: string }, path: string): string {
  return current.pathname === path ? current.hash : ""
}

/**
 * Welche Adresse die Seite einer Scheibe schreiben soll, damit Reload und Zurück den Zustand finden; null: nichts zu
 * tun. Ohne gewählten Reiter bleibt der Anker der Adresse (etwa „#shots“ aus der Sprungleiste), mit Reiter steht er in
 * `address`. Verglichen wird ohne Anker: `urlFromRoute` lässt Vorgaben weg, die Adresse zurück zur Vorgabe ist kürzer
 * und wäre sonst ein Präfix der alten (Review: die alte Serie kam nach dem Neuladen zurück).
 */
export function nextCardAddress(
  current: { pathname: string; search: string; hash: string },
  address: string,
  anchorChosen: boolean
): string | null {
  const base = `${current.pathname}${current.search}`
  if (anchorChosen) return `${base}${current.hash}` === address ? null : address
  return base === address ? null : `${address}${current.hash}`
}

/**
 * Die Wertung in der Adresse der Seite einer Scheibe: nur solange die gezeigte nicht die der Scheibe ist (aus einem
 * Rekord geöffnet, das Speichern unterwegs). Ohne Angabe öffnet die Scheibe in ihrer (Plan
 * `plans/2026-10-12-spiegel-wertung.md`).
 */
export const addressScoring = (shown: Scoring, own: Scoring): Scoring | null =>
  shown === own ? null : shown
