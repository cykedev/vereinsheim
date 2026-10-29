// Passt ein Meyton-Ausdruck aus Treffsicher zu seiner Einheit ([[spiegel-account-transfer]])? Rein; dann werden seine
// Werte eine neue Revision über den Zahlen aus Treffsicher (`adoptPrintoutValues`), sonst hängt er ohne Werte an.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { PrintoutValuesRead } from "../printouts/store"

/**
 * Die Lesung ist `ok` und keine reine Probe, der Abend des Drucks ist der Abend der Einheit, die Zahl der
 * Wertungsschüsse ist gleich und das Gesamtergebnis gleich in der Wertung von Treffsicher (`WHOLE`: ganze Ringe,
 * `TENTH`: Zehntel). Ohne Gesamtergebnis in Treffsicher passt kein Ausdruck.
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
  const reading = printout.values.reading
  if (printout.values.status !== "ok" || reading === null || reading.probe || !reading.total)
    return false
  if (eveningDay(printout.printedAt.getTime(), timeZone) !== unit.day) return false
  if (reading.shots.length !== unit.shots) return false
  const wanted = unit.scoring === "WHOLE" ? unit.total?.rings : unit.total?.decimalTenths
  const printed = unit.scoring === "WHOLE" ? reading.total.rings : reading.total.decimalTenths
  return wanted !== undefined && wanted !== null && wanted === printed
}
