// Mitte der Schüsse über mehrere Scheiben, aus Lagen je Schuss und der Trefferlage als Summe. Nicht über `./index`
// exportiert: eine Hilfe für die Projektion und das Trefferbild eines Zeitraums, keine Auswertung mit Katalog-ID.

import type { CardCenter } from "./projection"

/**
 * Mitte der Schüsse mehrerer Scheiben, gewichtet mit der Schusszahl jeder Mitte (Σ nᵢ·cᵢ / Σ nᵢ), aus Lagen je Schuss
 * und der Trefferlage als Summe; `summaryShots` zählt die Schüsse aus Summen. Nur Versatz und Richtung ([[adr-034]]):
 * Streuung und Urteile nehmen nur Lagen je Schuss. Null ohne Mitte.
 */
export function pooledCenter(
  centers: readonly (CardCenter | null | undefined)[]
): { xUm: number; yUm: number; n: number; summaryShots: number } | null {
  const given = centers.filter((c): c is CardCenter => !!c)
  const n = given.reduce((sum, c) => sum + c.n, 0)
  if (!n) return null
  return {
    xUm: given.reduce((sum, c) => sum + c.n * c.xUm, 0) / n,
    yUm: given.reduce((sum, c) => sum + c.n * c.yUm, 0) / n,
    n,
    summaryShots: given.reduce((sum, c) => sum + (c.from === "summary" ? c.n : 0), 0),
  }
}
