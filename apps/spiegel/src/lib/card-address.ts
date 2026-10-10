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
