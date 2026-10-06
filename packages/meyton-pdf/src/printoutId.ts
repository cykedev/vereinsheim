// Die ID im Fuß des Meyton-Ausdrucks (`ID: ff914420 - Seite: 1`), vermutlich die ScheibenID als
// vorzeichenbehaftete 32-Bit-Zahl (ADR-028, meyton-printout). Gesucht wird nur dieses Muster, ohne
// Wissen über das Layout, und auf allen Seiten (SF-44). Mehrere verschiedene IDs sind ein Widerspruch:
// Dann wird nicht geraten.

export type PrintoutIdResult =
  | { kind: "found"; hex: string; value: number; pages: number[] }
  | { kind: "missing" }
  | { kind: "conflict"; hexes: string[] }

/**
 * `ID:` ohne Buchstabe oder Ziffer davor (sonst träfe `DisziplinID:`), dann genau acht Hex-Zeichen,
 * danach kein Buchstabe und keine Ziffer. Zwischen den Zeichen ist je ein Leerzeichen erlaubt: Qt setzt
 * jedes Glyph einzeln, und pdf.js fasst sie nicht immer zusammen.
 */
const PRINTOUT_ID = /(?<![0-9A-Za-z])I\s?D\s?:\s*((?:[0-9A-Fa-f]\s?){7}[0-9A-Fa-f])(?![0-9A-Za-z])/g
const HEX_ID = /^[0-9A-Fa-f]{8}$/

/** acht Hex-Zeichen als vorzeichenbehaftete 32-Bit-Zahl */
export function decodePrintoutId(hex: string): number {
  if (!HEX_ID.test(hex)) throw new RangeError(`"${hex}" ist keine ID aus acht Hex-Zeichen`)
  const unsigned = Number.parseInt(hex, 16)
  return unsigned >= 0x8000_0000 ? unsigned - 0x1_0000_0000 : unsigned
}

/** Sucht auf allen Seiten; `pageTexts[0]` ist Seite 1. */
export function findPrintoutId(pageTexts: readonly string[]): PrintoutIdResult {
  const pagesByHex = new Map<string, Set<number>>()
  pageTexts.forEach((text, index) => {
    // Leerraum zusammenfassen: pdf.js setzt Lücken zwischen einzelnen Glyphen als eigene Stücke.
    for (const match of text.replace(/\s+/g, " ").matchAll(PRINTOUT_ID)) {
      const hex = match[1].replace(/\s/g, "").toLowerCase()
      const pages = pagesByHex.get(hex) ?? new Set<number>()
      pages.add(index + 1)
      pagesByHex.set(hex, pages)
    }
  })
  if (pagesByHex.size === 0) return { kind: "missing" }
  if (pagesByHex.size > 1) return { kind: "conflict", hexes: [...pagesByHex.keys()].sort() }
  const [[hex, pages]] = pagesByHex
  return {
    kind: "found",
    hex,
    value: decodePrintoutId(hex),
    pages: [...pages].sort((a, b) => a - b),
  }
}
