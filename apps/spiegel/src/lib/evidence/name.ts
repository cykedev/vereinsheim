// Der Name eines Belegs ([[adr-033]]): der Name der Datei, wie der Browser sie schickt, ohne Umbenennen. Rein, im Server
// und im Browser.

/** so lang darf ein gespeicherter Name sein, in Codepoints */
export const EVIDENCE_NAME_MAX = 120

/** so lang darf die Endung sein, die beim Kürzen stehen bleibt (nach dem letzten Punkt) */
const EXTENSION_MAX = 10

const ELLIPSIS = "…"

/**
 * Steuerzeichen, Richtungszeichen wie U+202E (sie ließen einen Namen anders aussehen), Leerzeichen ohne Breite und das
 * BOM; Verbinder wie U+200D bleiben, sie gehören zu Emoji und manchen Schriften
 */
const INVISIBLE = /[\p{Cc}\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu

/** Stamm und Endung (mit Punkt); ohne Endung, wenn der Punkt fehlt, vorn steht oder die Endung zu lang ist */
function splitName(name: string): { stem: string; extension: string } {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return { stem: name, extension: "" }
  const extension = name.slice(dot)
  if ([...extension].length - 1 > EXTENSION_MAX) return { stem: name, extension: "" }
  return { stem: name.slice(0, dot), extension }
}

/** kürzt auf höchstens `max` Codepoints; der Stamm endet dann mit „…“, die Endung bleibt */
function shortenEnd(name: string, max: number): string {
  const chars = [...name]
  if (chars.length <= max) return name
  const { stem, extension } = splitName(name)
  const room = max - [...extension].length - 1
  if (room < 1) return chars.slice(0, max - 1).join("") + ELLIPSIS
  return [...stem].slice(0, room).join("").trimEnd() + ELLIPSIS + extension
}

/** der Name einer Datei zum Speichern: nur der letzte Teil eines Pfads, ohne unsichtbare Zeichen, gekürzt; leer → null */
export function evidenceFileName(raw: string): string | null {
  // `toWellFormed`: ein einzelnes Surrogat ließe `encodeURIComponent` im Kopf der Antwort werfen
  const last = raw.toWellFormed().normalize("NFC").split(/[/\\]/).pop() ?? ""
  const clean = last.replace(INVISIBLE, "").replace(/\s+/gu, " ").trim()
  if (!clean) return null
  return shortenEnd(clean, EVIDENCE_NAME_MAX)
}

/** ein Name für Berichte, in der Mitte gekürzt; die Endung bleibt stehen (`print_7f3a…c2.pdf`) */
export function shortName(name: string, max = 40): string {
  const chars = [...name]
  if (chars.length <= max) return name
  const { stem, extension } = splitName(name)
  const stemChars = [...stem]
  const room = max - [...extension].length - 1
  if (room < 2) return chars.slice(0, max - 1).join("") + ELLIPSIS
  const head = Math.ceil(room / 2)
  const tail = room - head
  return stemChars.slice(0, head).join("") + ELLIPSIS + stemChars.slice(-tail).join("") + extension
}
