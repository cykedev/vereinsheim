// Die ID im Fuß des Meyton-Ausdrucks (`ID: ff914420 - Seite: 1`), vermutlich die ScheibenID als
// vorzeichenbehaftete 32-Bit-Zahl (ADR-028, meyton-printout). Gesucht wird nur dieses Muster, ohne
// Wissen über das Layout, und auf allen Seiten (SF-44). Mehrere verschiedene IDs sind ein Widerspruch:
// Dann wird nicht geraten.

export type PrintoutIdResult =
  | { kind: "found"; hex: string; value: number; pages: number[] }
  | { kind: "missing" }
  | { kind: "conflict"; hexes: string[] }

/**
 * `ID:` ohne Buchstabe oder Ziffer davor (auch keine Umlaute; sonst träfe `DisziplinID:`), dann genau
 * acht Hex-Zeichen am Stück, danach kein Buchstabe und keine Ziffer. Zweite Form: jedes Zeichen einzeln
 * mit genau einem Leerzeichen dazwischen (`I D : f f 9 1 …`), wie pdf.js einzeln gesetzte Qt-Glyphen
 * liefert. Unregelmäßige Lücken ergeben „keine ID“, nie eine aus getrennten Wörtern gebaute.
 */
const PRINTOUT_ID =
  /(?<![\p{L}\p{N}])(?:ID: ?([0-9A-Fa-f]{8})|I D : ((?:[0-9A-Fa-f] ){7}[0-9A-Fa-f]))(?![\p{L}\p{N}])/gu
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
      const hex = (match[1] ?? match[2]).replace(/\s/g, "").toLowerCase()
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
