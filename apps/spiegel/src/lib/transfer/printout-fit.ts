// Passt ein Meyton-Ausdruck aus Treffsicher zu seiner Einheit ([[spiegel-account-transfer]])? Rein; dann werden seine
// Werte eine neue Revision über den Zahlen aus Treffsicher (`adoptPrintoutValues`), sonst hängt er ohne Werte an.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { PrintoutValuesRead } from "../printouts/store"
import { scoringReading } from "../printouts/values"

/**
 * Die Lesung ist `ok`, der Abend des Drucks ist der Abend der Einheit, die Zahl der Schüsse ist gleich und das
 * Gesamtergebnis gleich in der Wertung von Treffsicher (`WHOLE`: ganze Ringe, `TENTH`: Zehntel). Ein Ausdruck im Modus
 * Probe zählt als Wertung, sein Ergebnis ist die Summe seiner Schüsse (`scoringReading`). Ohne Gesamtergebnis in
 * Treffsicher passt kein Ausdruck.
 */
export function printoutFits(
  printout: { printedAt: Date; values: Pick<PrintoutValuesRead, "status" | "reading"> },
  unit: {
    day: string
    scoring: "WHOLE" | "TENTH"
    shots: number
    total: { rings?: number | null; decimalTenths?: number | null } | null
  },
  timeZone: string
): boolean {
  const read = printout.values.reading
  if (printout.values.status !== "ok" || read === null) return false
  const reading = scoringReading(read)
  if (!reading.total) return false
  if (eveningDay(printout.printedAt.getTime(), timeZone) !== unit.day) return false
  if (reading.shots.length !== unit.shots) return false
  const wanted = unit.scoring === "WHOLE" ? unit.total?.rings : unit.total?.decimalTenths
  const printed = unit.scoring === "WHOLE" ? reading.total.rings : reading.total.decimalTenths
  return wanted !== undefined && wanted !== null && wanted === printed
}
