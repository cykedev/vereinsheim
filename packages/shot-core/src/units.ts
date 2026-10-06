// Einheiten des Fachkerns.
//
// Längen rechnet shot-core in ganzen Mikrometern (µm). Scheibenbilder werden in mm notiert, wie in
// der Sportordnung, und hier umgerechnet. Ergibt ein Maß kein ganzes µm, ist es ein Tippfehler oder
// eine Scheibe, für die die exakte Wertung (scoring.ts) nicht gilt; beides soll laut auffallen.

/** mm → ganze µm. Wirft, wenn das Maß kein ganzes µm ergibt. */
export function mmToUm(mm: number): number {
  const um = Math.round(mm * 1000)
  if (!Number.isFinite(mm) || Math.abs(mm * 1000 - um) > 1e-6) {
    throw new RangeError(`${mm} mm ist kein ganzes µm`)
  }
  return um
}
