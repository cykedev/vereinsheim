import { decodePrintoutId } from "@vereinsheim/meyton-pdf/printout-id"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

// Die ID einer Scheibe, wie der Schütze sie vom Ausdruck abtippt, und der Abend, an dem die Scheibe lief. Reine
// Funktionen, ohne Datenbank.

/** acht Hex-Zeichen wie im Fuß des Ausdrucks, wahlweise mit `ID:` davor; Groß und klein gleich */
const PRINTED_ID = /^(?:id:?)?([0-9a-f]{8})$/i

/**
 * Die ScheibenID aus der Eingabe, wie sie im Fuß des Ausdrucks steht (`ID: ff914420`); Leerzeichen zählen nicht. null,
 * wenn es keine ist. Die Zahl ist vorzeichenbehaftet wie in der Ablage (`ff914420` → −7257056, [[meyton-printout]]).
 */
export function parseCardId(input: string): { scheibenId: number; hex: string } | null {
  const match = PRINTED_ID.exec(input.replace(/\s/g, ""))
  if (!match) return null
  const hex = match[1].toLowerCase()
  return { scheibenId: decodePrintoutId(hex), hex }
}

/** die ID so, wie sie auf dem Ausdruck steht: acht Hex-Zeichen, klein */
export function printedId(scheibenId: number): string {
  return (scheibenId >>> 0).toString(16).padStart(8, "0")
}

/**
 * Der Abend einer Scheibe als `YYYY-MM-DD` aus ihrem groben Beginn (`startHintMs`): Meyton schreibt Ortszeit, die der
 * Beginn als UTC trägt; vor 4 Uhr zählt der Vortag wie in Liste und Kalender (`eveningDay`).
 */
export const eveningOfStart = (startHintMs: number) => eveningDay(startHintMs, "UTC")
