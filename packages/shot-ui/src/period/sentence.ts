// Worte für den Vergleich und der Satz im Kopf der Seite eines Zeitraums (Plan L3, D6, D14). „bedeutsam“
// nur neben einem Urteil (L2, B19: ohne Veränderung trifft es bei 5 gegen 5 Scheiben oft zu).

import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"

import { formatValue } from "../format"
import { PREVIOUS_LABEL } from "./calendar"
import type { PeriodModel } from "./model"

/** „höher, besser · bedeutsam“, „tiefer“, „nicht nachweisbar“, „zu wenige Scheiben“ */
export function verdictText(
  comparison: PeriodComparison,
  better: "higher" | "lower" | "none"
): string {
  if (comparison.test === null) return "zu wenige Scheiben"
  if (comparison.verdict === "unclear") return "nicht nachweisbar"
  const up = comparison.verdict === "higher"
  const judged = better === "none" ? "" : (better === "higher") === up ? ", besser" : ", schwächer"
  return `${up ? "höher" : "tiefer"}${judged}${comparison.meaningful ? " · bedeutsam" : ""}`
}

/** unter diesem Abstand heißt es „gleichauf“: zwei Stellen nach dem Komma zeigten 0,00 */
const LEVEL = 0.005

/**
 * Ein Satz zum Zeitraum (D14), immer über den Ø je Schuss wie die Ergebnis-Box: mit Vergleich der Unterschied
 * mit „nachweisbar“ nur bei einem Urteil, sonst die letzte Scheibe gegen den Schnitt der 30 Tage davor, sonst
 * keiner.
 */
export function periodSentence(model: PeriodModel): string | null {
  if (model.compareRange) {
    const other =
      model.compareRange.label === PREVIOUS_LABEL
        ? { dative: "dem Zeitraum davor", als: "im Zeitraum davor" }
        : {
            dative: `„${model.compareRange.label}“`,
            als: `in „${model.compareRange.label}“`,
          }
    const c = model.comparison
    if (!c || c.test === null) {
      return `Für einen Vergleich mit ${other.dative} sind es zu wenige Scheiben.`
    }
    if (Math.abs(c.delta) < LEVEL) return `Dein Ø je Schuss liegt gleichauf mit ${other.dative}.`
    // „…, nicht nachweisbar“ klang wie ein Widerspruch zur Zahl davor (Prüfung, 9. Oktober 2026)
    const proven =
      c.verdict === "unclear"
        ? "der Unterschied ist aber nicht nachweisbar"
        : "der Unterschied ist nachweisbar"
    const direction = c.delta > 0 ? "höher" : "tiefer"
    return `Dein Ø je Schuss liegt ${formatValue(Math.abs(c.delta), 2)} ${direction} als ${other.als}; ${proven}.`
  }
  const average = model.ownAverage?.average
  if (!average) return null
  if (Math.abs(average.delta) < LEVEL) {
    return "Deine neueste Scheibe lag im Ø je Schuss genau auf deinem Schnitt der 30 Tage davor."
  }
  return `Deine neueste Scheibe lag im Ø je Schuss ${formatValue(Math.abs(average.delta), 2)} ${average.delta > 0 ? "über" : "unter"} deinem Schnitt der 30 Tage davor.`
}
